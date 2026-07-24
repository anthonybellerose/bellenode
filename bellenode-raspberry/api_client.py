"""
Client API Bellenode pour le Raspberry Pi.

Endpoints utilisés :
  POST /api/auth/login              → JWT token
  POST /api/scan/batch              → envoie un batch d'opérations
  GET  /api/products/cache-pi       → liste allégée des produits (cache local)
  GET  /api/inventory                → stock actuel par restaurant
  GET  /api/inventory/objectifs      → statut min/max/qtyPending (Stock bas, À venir)
  GET  /api/batches, /api/batches/{id} → historique des entrées/sorties
"""
import logging
import time
import requests
import config

logger = logging.getLogger(__name__)

MODE_API = {"plus": "+", "minus": "-", "set": "="}


class BellenodeClient:
    def __init__(self):
        self._token: str | None = None
        self._token_expiry: float = 0
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": "BellenodeRaspberry/1.0"})

        # Cache produits : codeUpc → {nom, volume, codeSaq}
        self._products: dict[str, dict] = {}
        # Cache inventaire : codeUpc → stock actuel (estimé localement)
        self._stock: dict[str, int] = {}

    # ── Auth ──────────────────────────────────────────────────────────────────

    def login(self) -> bool:
        try:
            r = self._session.post(
                f"{config.API_URL}/api/auth/login",
                json={"email": config.API_EMAIL, "password": config.API_PASSWORD},
                timeout=10,
            )
            r.raise_for_status()
            data = r.json()
            self._token = data["token"]
            self._token_expiry = time.time() + 23 * 3600
            self._session.headers.update({
                "Authorization": f"Bearer {self._token}",
                "X-Restaurant-Id": str(config.RESTAURANT_ID),
            })
            logger.info("Authentifié sur Bellenode")
            return True
        except Exception as e:
            logger.error(f"Échec login : {e}")
            return False

    def _ensure_auth(self) -> bool:
        if self._token and time.time() < self._token_expiry:
            return True
        return self.login()

    # ── Cache produits ────────────────────────────────────────────────────────

    def refresh_products(self) -> bool:
        """Télécharge la liste complète des produits et le stock actuel."""
        if not self._ensure_auth():
            return False
        try:
            # Produits globaux (liste allégée dédiée, /api/products exige une recherche
            # depuis le fix de perf de la page web du 2026-07-02)
            r = self._session.get(f"{config.API_URL}/api/products/cache-pi", timeout=30)
            r.raise_for_status()
            for p in r.json():
                upc = p.get("codeUpc") or p.get("code", "")
                if upc:
                    self._products[upc] = {
                        "nom":      p.get("nom", "Produit inconnu"),
                        "volume":   p.get("volume", ""),
                        "imageUrl": p.get("imageUrl"),
                    }

            # Stock actuel du restaurant
            r2 = self._session.get(
                f"{config.API_URL}/api/inventory",
                timeout=15,
            )
            r2.raise_for_status()
            for item in r2.json():
                code = item.get("code", "")
                if code:
                    self._stock[code] = item.get("quantite", 0)

            logger.info(f"Cache produits : {len(self._products)} produits, {len(self._stock)} en stock")
            return True
        except Exception as e:
            logger.error(f"Erreur refresh_products : {e}")
            return False

    def lookup(self, barcode: str) -> dict | None:
        """Retourne les infos du produit depuis le cache, ou None si inconnu."""
        return self._products.get(barcode)

    def get_stock(self, barcode: str) -> int:
        return self._stock.get(barcode, 0)

    def get_image_url(self, code: str) -> str | None:
        """URL de la photo produit depuis le cache local (pas de requête réseau)."""
        product = self._products.get(code)
        return product.get("imageUrl") if product else None

    def apply_local_stock(self, barcode: str, mode: str, qty: int = 1):
        """Met à jour le stock local immédiatement (avant confirmation serveur).
        N'est PAS appelé en mode SET — voir set_local_stock, le compte SET n'est
        confirmé qu'au bouton "Terminer le compte" (main.py::_finish_set_count)."""
        current = self._stock.get(barcode, 0)
        if mode == "plus":
            self._stock[barcode] = current + qty
        elif mode == "minus":
            self._stock[barcode] = max(0, current - qty)

    def set_local_stock(self, barcode: str, qty: int):
        """Fixe directement le stock local connu — appelé une fois un compte SET
        confirmé et envoyé avec succès, pour que les +/- suivants partent du bon total
        sans attendre le prochain refresh_products (login ou réconciliation nocturne)."""
        self._stock[barcode] = qty

    # ── Envoi batch ───────────────────────────────────────────────────────────

    def send_batch(self, operations: list[dict], note: str = "") -> dict | None:
        """
        Envoie une liste d'opérations en un seul batch.
        operations : [{"mode": "plus"|"minus"|"set", "code": "...", "quantite": 1}, ...]
        Retourne le dict résultat, ou None si erreur réseau.
        """
        if not self._ensure_auth():
            return None
        if not operations:
            return None
        try:
            payload = {
                "restaurantId": config.RESTAURANT_ID,
                "note": note,
                "createdBy": "Raspberry Pi",
                "operations": [
                    {
                        "mode": MODE_API.get(op["mode"], "-"),
                        "code": op["code"],
                        "quantite": op.get("quantite", 1),
                    }
                    for op in operations
                ],
            }
            r = self._session.post(
                f"{config.API_URL}/api/scan/batch",
                json=payload,
                timeout=30,
            )
            r.raise_for_status()
            result = r.json()
            logger.info(
                f"Batch envoyé : {len(operations)} op(s) → batch #{result.get('batchId')}"
            )
            return result
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else None
            if status is not None and 400 <= status < 500:
                # Le serveur a rejeté ces données pour de bon (ex: code-barres invalide/trop
                # long) — pas une panne réseau. Retenter indéfiniment ne changerait rien et
                # bloquerait la file pour toujours (vu en test le 2026-07-24 : un scan bidon
                # de touches restées appuyées gardait "1 en attente" figé sur l'écran du Pi).
                logger.error(f"Batch rejeté définitivement (HTTP {status}), abandonné : {e}")
                return {"batchId": None, "rejected": True}
            logger.warning(f"Erreur réseau send_batch : {e}")
            return None
        except Exception as e:
            logger.warning(f"Erreur réseau send_batch : {e}")
            return None

    def is_online(self) -> bool:
        try:
            r = self._session.get(f"{config.API_URL}/api/products", timeout=5)
            return r.status_code < 500
        except Exception:
            return False

    # ── Consultation (lecture seule) ─────────────────────────────────────────
    # Utilisées par les écrans Inventaire / Stock bas / À venir / Historique.
    # Aucune de ces routes ne modifie l'inventaire.

    def get_inventory(self) -> list[dict] | None:
        """Liste complète de l'inventaire du restaurant (nom, qté, prix, maj)."""
        if not self._ensure_auth():
            return None
        try:
            r = self._session.get(f"{config.API_URL}/api/inventory", timeout=15)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.warning(f"Erreur get_inventory : {e}")
            return None

    def get_objectifs(self, status: str | None = None, inventory_only: bool = True) -> list[dict] | None:
        """Stock + min/max/statut/qtyPending par produit (source pour Stock bas et À venir).

        inventory_only=False est nécessaire pour Stock bas : un objectif peut viser un
        produit jamais physiquement scanné (donc absent de l'inventaire), et cette
        vue doit rester cohérente avec le badge du header (même source, mêmes filtres).
        """
        if not self._ensure_auth():
            return None
        try:
            params: dict[str, str] = {}
            if inventory_only:
                params["inventoryOnly"] = "true"
            if status:
                params["status"] = status
            r = self._session.get(
                f"{config.API_URL}/api/inventory/objectifs",
                params=params,
                timeout=15,
            )
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.warning(f"Erreur get_objectifs : {e}")
            return None

    def get_batches(self) -> list[dict] | None:
        """Historique des entrées/sorties du restaurant, peu importe la source (Pi ou web)."""
        if not self._ensure_auth():
            return None
        try:
            r = self._session.get(f"{config.API_URL}/api/batches", timeout=15)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.warning(f"Erreur get_batches : {e}")
            return None

    def get_batch_detail(self, batch_id: int) -> dict | None:
        """Détail des opérations d'un batch (produit par produit)."""
        if not self._ensure_auth():
            return None
        try:
            r = self._session.get(f"{config.API_URL}/api/batches/{batch_id}", timeout=15)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.warning(f"Erreur get_batch_detail : {e}")
            return None
