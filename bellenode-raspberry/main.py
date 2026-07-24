#!/usr/bin/env python3
"""
Bellenode Raspberry Pi Scanner — Point d'entrée principal.

Fonctionnement :
  - Chaque scan est sauvegardé localement (SQLite) immédiatement
  - Les scans sont envoyés à Bellenode en mini-batches toutes les 30s
  - Si le réseau est coupé, les scans s'accumulent et partent dès le retour
  - Réconciliation nocturne à 2h pour vérifier qu'il ne reste rien en attente

Usage :
  python3 main.py             # mode réel (evdev, écran tkinter)
  python3 main.py --simulate  # mode simulation (stdin)
  python3 main.py --no-ui     # sans interface graphique (debug)
"""
import argparse
import logging
import os
import queue
import sys
import threading
import time
from datetime import datetime

import config
import image_cache
from api_client import BellenodeClient
from queue_db import LocalQueue
from scanner import ScannerReader

os.makedirs(config.LOGS_DIR, exist_ok=True)
os.makedirs(config.DATA_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(config.LOGS_DIR, "bellenode.log")),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("main")


class BellenodeScanner:
    def __init__(self, simulate: bool = False, no_ui: bool = False):
        self.simulate  = simulate
        self.no_ui     = no_ui
        self.mode      = config.DEFAULT_MODE

        self.today_scan_count = 0       # scans de la journée (affichage)
        self._scan_queue: queue.Queue = queue.Queue()

        self.api = BellenodeClient()
        self.db  = LocalQueue()
        self.ui  = None
        self._stop = threading.Event()

    # ── Démarrage ─────────────────────────────────────────────────────────────

    def start(self):
        logger.info("=== Bellenode Scanner démarrage ===")

        # Auth + cache produits
        if self.api.login():
            self.api.refresh_products()
        else:
            logger.warning("Démarrage en mode offline — cache produits vide")

        # Threads de fond
        ScannerReader(self._scan_queue, simulate=self.simulate).start()
        threading.Thread(target=self._flush_loop,     daemon=True, name="FlushLoop").start()
        threading.Thread(target=self._reconcile_loop, daemon=True, name="ReconcileLoop").start()
        threading.Thread(target=self._scan_loop,      daemon=True, name="ScanLoop").start()
        threading.Thread(target=self._status_loop,    daemon=True, name="StatusLoop").start()
        threading.Thread(target=self._lowstock_loop,  daemon=True, name="LowstockLoop").start()

        # Interface graphique (thread principal tkinter)
        if not self.no_ui:
            from ui import RaspberryUI
            self.ui = RaspberryUI(
                on_mode_change=self._change_mode,
                on_new_batch=self._flush_now,
                on_finish_set=self._finish_set_count,
                on_navigate=self._on_navigate,
                on_open_batch_detail=self._on_open_batch_detail,
                on_request_image=self._on_request_image,
            )
            self.ui.update_mode(self.mode)
            self.ui.update_status(self.api.is_online(), self.db.pending_count())
            self.ui.run()
        else:
            logger.info("Mode --no-ui actif (Ctrl+C pour arrêter)")
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                logger.info("Arrêt")

    # ── Changement de mode ────────────────────────────────────────────────────

    def _change_mode(self, mode: str):
        self.mode = mode
        logger.info(f"Mode : {mode}")
        if self.ui:
            self.ui.update_mode(mode)

    # ── Boucle principale des scans ───────────────────────────────────────────

    def _scan_loop(self):
        while not self._stop.is_set():
            try:
                barcode = self._scan_queue.get(timeout=1)
            except queue.Empty:
                continue
            self._handle_barcode(barcode)

    def _handle_barcode(self, barcode: str):
        # Commandes spéciales imprimées sur feuille plastifiée
        if barcode == config.CMD_MODE_PLUS:
            self._change_mode("plus"); return
        if barcode == config.CMD_MODE_MINUS:
            self._change_mode("minus"); return
        if barcode == config.CMD_MODE_SET:
            self._change_mode("set"); return
        if barcode == config.CMD_NEW_BATCH:
            self._flush_now(); return
        if barcode == config.CMD_SEND_NOW:
            self._flush_now(); return

        # Cherche le produit dans le cache local
        product = self.api.lookup(barcode)

        # Sauvegarde locale immédiate (peu importe si produit connu ou non)
        scan_id = self.db.push(barcode, self.mode, batch_id=0)

        # Mise à jour du stock local optimiste
        stock_before = self.api.get_stock(barcode)
        self.api.apply_local_stock(barcode, self.mode)
        stock_after = self.api.get_stock(barcode)

        self.today_scan_count += 1

        if product:
            nom    = product["nom"]
            volume = product.get("volume", "")
            logger.info(f"✓ [{self.mode}] {nom} {volume}  {stock_before}→{stock_after}")
            if self.ui:
                self.ui.update_scan(nom, volume, stock_before, stock_after, self.today_scan_count)
                cached_path = image_cache.get_cached_path(barcode)
                self.ui.update_scan_image(barcode, cached_path)
                if not cached_path and product.get("imageUrl"):
                    self._on_request_image(barcode, product["imageUrl"])
        else:
            logger.warning(f"Produit non référencé : {barcode}")
            if self.ui:
                self.ui.show_unknown(barcode)

        # Mise à jour statut
        if self.ui:
            self.ui.update_status(True, self.db.pending_count())

    # ── Envoi vers Bellenode ──────────────────────────────────────────────────

    def _flush_loop(self):
        """Envoie les scans en attente toutes les 30 secondes."""
        while not self._stop.is_set():
            time.sleep(config.RETRY_INTERVAL)
            self._flush_now()

    def _flush_now(self):
        """Envoie les scans +/- en attente. Le mode SET est exclu — voir
        _finish_set_count : un compte SET doit être confirmé explicitement plutôt que
        parti par ce flush périodique, sinon une session de comptage qui dépasse 30s se
        retrouve coupée en plusieurs envois séparés, et le serveur (qui ne sait
        additionner un SET que DANS un même envoi) réinitialise le compte à chaque
        nouveau lot au lieu de continuer à l'additionner (bug trouvé en test le
        2026-07-23 — les quantités retombaient toutes à 1)."""
        pending = [s for s in self.db.get_pending() if s.mode != "set"]
        if not pending:
            return

        logger.info(f"Envoi de {len(pending)} scan(s) vers Bellenode...")

        ops = [{"mode": s.mode, "code": s.barcode, "quantite": 1} for s in pending]
        note = f"Raspberry Pi — {datetime.now().strftime('%Y-%m-%d %H:%M')}"

        result = self.api.send_batch(ops, note=note)

        if result is not None:
            # Succès — marquer tous comme envoyés
            for s in pending:
                self.db.mark_sent(s.id)
            logger.info(f"Batch #{result.get('batchId')} envoyé avec succès")

            if self.ui:
                self.ui.update_status(True, self.db.pending_count())
                self.ui.update_batch(result.get("batchId"), len(pending))
        else:
            # Échec réseau — incrémenter les tentatives, réessai au prochain flush
            for s in pending:
                self.db.increment_attempt(s.id)
            logger.warning("Envoi échoué — nouveau essai dans 30s")

            if self.ui:
                self.ui.update_status(False, self.db.pending_count())

    def _finish_set_count(self):
        """Appelé par le bouton explicite 'Terminer le compte' de l'écran Scan (mode SET
        uniquement). Regroupe tous les scans SET en attente par code-barres (compte le
        nombre de fois où chacun a été scanné) et envoie UN SEUL lot avec le total final
        par produit — le serveur applique alors le compte correctement puisque tout
        arrive dans le même envoi (voir _flush_now)."""
        pending = [s for s in self.db.get_pending() if s.mode == "set"]
        if not pending:
            if self.ui:
                self.ui.show_error("Aucun scan en mode SET à confirmer.")
            return

        counts: dict[str, int] = {}
        for s in pending:
            counts[s.barcode] = counts.get(s.barcode, 0) + 1

        logger.info(f"Confirmation du compte SET : {len(counts)} produit(s), {len(pending)} scan(s)")

        ops = [{"mode": "set", "code": code, "quantite": qty} for code, qty in counts.items()]
        note = f"Raspberry Pi — compte SET {datetime.now().strftime('%Y-%m-%d %H:%M')}"

        result = self.api.send_batch(ops, note=note)

        if result is not None:
            for s in pending:
                self.db.mark_sent(s.id)
            logger.info(f"Batch #{result.get('batchId')} (compte SET) envoyé avec succès")
            if self.ui:
                self.ui.update_status(True, self.db.pending_count())
                self.ui.update_batch(result.get("batchId"), len(counts))
        else:
            for s in pending:
                self.db.increment_attempt(s.id)
            logger.warning("Envoi du compte SET échoué — réessaie via le bouton Terminer")
            if self.ui:
                self.ui.show_error("Échec de l'envoi — réessaie.")
                self.ui.update_status(False, self.db.pending_count())

    # ── Vérification périodique de la connexion réseau ───────────────────────

    def _status_loop(self):
        """Sonde la connexion réelle en continu, même sans scan en attente,
        pour que le statut affiché ne reste jamais figé sur un état périmé."""
        while not self._stop.is_set():
            time.sleep(config.STATUS_CHECK_INTERVAL)
            online = self.api.is_online()
            if self.ui:
                self.ui.update_status(online, self.db.pending_count())

    # ── Badge stock bas (écran principal) ─────────────────────────────────────

    def _lowstock_loop(self):
        """Sonde en continu le même décompte que l'écran Stock bas, pour que le badge
        du header et la liste ne soient jamais en désaccord (voir _load_stockbas)."""
        while not self._stop.is_set():
            time.sleep(config.LOWSTOCK_CHECK_INTERVAL)
            rows = self._fetch_stockbas()
            if rows is not None and self.ui:
                self.ui.update_lowstock_badge(len(rows))

    # ── Écrans de consultation (Inventaire / Stock bas / À venir / Historique) ─

    def _on_navigate(self, screen: str):
        """Appelé par l'UI quand un écran de consultation s'ouvre (ou se rafraîchit) —
        déclenche la récupération des données en arrière-plan pour ne pas bloquer tkinter."""
        loaders = {
            "inventaire": self._load_inventaire,
            "stockbas":   self._load_stockbas,
            "avenir":     self._load_avenir,
            "historique": self._load_historique,
        }
        loader = loaders.get(screen)
        if loader:
            threading.Thread(target=loader, daemon=True, name=f"Load-{screen}").start()

    def _on_open_batch_detail(self, batch_id: int):
        threading.Thread(
            target=self._load_historique_detail, args=(batch_id,),
            daemon=True, name="Load-historique_detail",
        ).start()

    def _load_inventaire(self):
        items = self.api.get_inventory() or []
        for it in items:
            it["imageUrl"] = self.api.get_image_url(it.get("code"))
        if self.ui:
            self.ui.set_list_data("inventaire", items)

    def _fetch_stockbas(self) -> list[dict] | None:
        """Produits sous leur seuil min, catalogue complet (pas seulement inventoryOnly) —
        un objectif peut viser un produit jamais scanné physiquement. Utilisé par l'écran
        Stock bas ET le badge du header pour qu'ils affichent toujours le même compte."""
        bas = self.api.get_objectifs(status="bas", inventory_only=False)
        rupture = self.api.get_objectifs(status="rupture", inventory_only=False)
        if bas is None or rupture is None:
            return None
        return bas + rupture

    def _load_stockbas(self):
        rows = self._fetch_stockbas()
        if self.ui:
            self.ui.set_list_data("stockbas", rows or [])

    def _load_avenir(self):
        objectifs = self.api.get_objectifs() or []
        rows = [o for o in objectifs if (o.get("qtyPending") or 0) > 0]
        for o in rows:
            o["imageUrl"] = self.api.get_image_url(o.get("code"))
        if self.ui:
            self.ui.set_list_data("avenir", rows)

    # ── Photos produits (téléchargement + cache, jamais sur le thread tkinter) ─

    def _on_request_image(self, code: str, url: str):
        threading.Thread(
            target=self._load_image, args=(code, url),
            daemon=True, name=f"Img-{code}",
        ).start()

    def _load_image(self, code: str, url: str):
        path = image_cache.fetch_and_cache(code, url)
        if self.ui:
            self.ui.set_image_ready(code, path)

    def _load_historique(self):
        batches = self.api.get_batches()
        if self.ui:
            self.ui.set_list_data("historique", batches or [])

    def _load_historique_detail(self, batch_id: int):
        detail = self.api.get_batch_detail(batch_id)
        operations = (detail or {}).get("operations", [])
        if self.ui:
            self.ui.set_list_data("historique_detail", operations)

    # ── Réconciliation nocturne ───────────────────────────────────────────────

    def _reconcile_loop(self):
        while not self._stop.is_set():
            now = datetime.now()
            if now.hour == config.RECONCILE_HOUR and now.minute == 0:
                logger.info("Réconciliation nocturne — flush des scans en attente")
                self._flush_now()
                # Rafraîchir le cache produits pour la nouvelle journée
                self.api.refresh_products()
                time.sleep(70)
            time.sleep(30)


# ── Entrée ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bellenode Scanner Raspberry Pi")
    parser.add_argument("--simulate", action="store_true", help="Mode simulation (stdin)")
    parser.add_argument("--no-ui",    action="store_true", help="Sans interface graphique")
    args = parser.parse_args()

    BellenodeScanner(simulate=args.simulate, no_ui=args.no_ui).start()
