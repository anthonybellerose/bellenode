"""
Interface tkinter pour écran tactile Raspberry Pi.
Conçu pour 800×480 (écran officiel 7²).

Écrans : Scan (accueil) ⇄ Menu ⇄ Inventaire / Stock bas / Commandes à venir /
Historique (→ détail d'un batch). Navigation par un bouton "☰ Menu" unique,
présent sur l'écran de scan et chaque écran de consultation.
"""
import queue
import tkinter as tk
from datetime import datetime
from typing import Callable

import config

MODE_LABELS = {
    "plus":  ("+ AJOUT",   "#22c55e"),   # vert
    "minus": ("- RETRAIT", "#ef4444"),   # rouge
    "set":   ("= SET",     "#f59e0b"),   # orange
}

BATCH_MODE_SYMBOLS = {
    "Add":    ("+", "#22c55e"),
    "Remove": ("-", "#ef4444"),
    "Set":    ("=", "#f59e0b"),
}

COLORS = {
    "bg":         "#0f0f1a",
    "card":       "#1a1a2e",
    "border":     "#2d2d4e",
    "text":       "#f1f5f9",
    "muted":      "#64748b",
    "accent":     "#3b82f6",
    "success":    "#22c55e",
    "error":      "#ef4444",
    "warning":    "#f59e0b",
}

LIST_PAGE_SIZE = 8


# ── Formatage des lignes de liste : (texte, id_cliquable_ou_None, couleur) ──

def _fmt_money(v) -> str:
    return f"${v:,.2f}" if v is not None else "—"


def _fmt_dt(iso: str | None) -> str:
    if not iso:
        return "—"
    try:
        return iso.split(".")[0].replace("T", " ")[:16]
    except Exception:
        return str(iso)[:16]


def _row_inventaire(item: dict):
    nom = (item.get("nom") or item.get("code") or "?")[:32]
    qty = item.get("quantite", 0)
    prix = _fmt_money(item.get("prix"))
    return f"{nom:<32} {qty:>5}  {prix:>8}", None, COLORS["text"]


def _row_stockbas(item: dict):
    nom = (item.get("nom") or item.get("code") or "?")[:26]
    qty = item.get("qtyActuelle", 0)
    minq = item.get("minQty") or 0
    rupture = item.get("statut") == "rupture"
    statut = "RUPTURE" if rupture else "BAS"
    color = COLORS["error"] if rupture else COLORS["warning"]
    return f"{nom:<26} {qty:>6}  min {minq:>4}  {statut}", None, color


def _row_avenir(item: dict):
    nom = (item.get("nom") or item.get("code") or "?")[:28]
    qty = item.get("qtyActuelle", 0)
    pend = item.get("qtyPending") or 0
    return f"{nom:<28} actuel {qty:>4}  en route {pend:>4}", None, COLORS["accent"]


def _row_historique(item: dict):
    dt = _fmt_dt(item.get("createdAt"))
    who = (item.get("createdBy") or "—")[:12]
    mvmt = f"+{item.get('totalAjouts', 0)}/-{item.get('totalRetraits', 0)}"
    produits = item.get("produitsTouches", 0)
    return f"{dt:<16} {who:<12} {mvmt:>8}  {produits} prod.", item.get("id"), COLORS["text"]


def _row_operation(op: dict):
    symbol, color = BATCH_MODE_SYMBOLS.get(op.get("mode"), ("?", COLORS["muted"]))
    nom = (op.get("nom") or op.get("code") or "?")[:26]
    avant = op.get("qtyAvant", 0)
    apres = op.get("qtyApres", 0)
    return f"{symbol} {nom:<26} {avant:>4} → {apres:<4}", None, color


FORMATTERS = {
    "inventaire":        _row_inventaire,
    "stockbas":          _row_stockbas,
    "avenir":            _row_avenir,
    "historique":        _row_historique,
    "historique_detail": _row_operation,
}

LIST_SCREENS = [
    # key, titre, en-tête colonnes, clickable, back_target, show_refresh
    ("inventaire", "Inventaire",
     f"{'Produit':<32} {'Qté':>5}  {'Prix':>8}",
     False, "menu", True),
    ("stockbas", "Stock bas",
     f"{'Produit':<26} {'Actuel':>6}  {'Min':>4}   Statut",
     False, "menu", True),
    ("avenir", "Commandes à venir",
     f"{'Produit':<28} {'Actuel':>10}  {'En route':>9}",
     False, "menu", True),
    ("historique", "Historique",
     f"{'Date/heure':<16} {'Par':<12} {'Mvmt':>8}  Produits",
     True, "menu", True),
    ("historique_detail", "Détail du batch",
     f"  {'Produit':<26} {'Avant':>4}   Après",
     False, "historique", False),
]


class RaspberryUI:
    def __init__(self, on_mode_change: Callable[[str], None],
                 on_new_batch: Callable[[], None],
                 on_navigate: Callable[[str], None],
                 on_open_batch_detail: Callable[[int], None]):
        self._on_mode_change = on_mode_change
        self._on_new_batch = on_new_batch
        self._on_navigate = on_navigate
        self._on_open_batch_detail = on_open_batch_detail
        self._update_queue: queue.Queue = queue.Queue()

        self._lists: dict[str, dict] = {}
        self._screens: dict[str, tk.Frame] = {}

        self.root = tk.Tk()
        self.root.title("Bellenode Scanner")
        self.root.configure(bg=COLORS["bg"])
        self.root.attributes("-fullscreen", config.FULLSCREEN)

        self._container = tk.Frame(self.root, bg=COLORS["bg"])
        self._container.pack(fill="both", expand=True)
        self._container.grid_rowconfigure(0, weight=1)
        self._container.grid_columnconfigure(0, weight=1)

        self._build_scan_screen()
        self._build_menu_screen()
        for key, title, header, clickable, back_target, show_refresh in LIST_SCREENS:
            self._build_list_screen(key, title, header, clickable=clickable,
                                     back_target=back_target, show_refresh=show_refresh)

        self._current = "scan"
        self._show("scan")

        # Traitement des updates depuis les autres threads
        self.root.after(100, self._process_updates)

    # ── Écran Scan (accueil) ──────────────────────────────────────────────────

    def _build_scan_screen(self):
        W = config.DISPLAY_WIDTH
        frame = tk.Frame(self._container, bg=COLORS["bg"])
        frame.grid(row=0, column=0, sticky="nsew")
        self._screens["scan"] = frame

        # ── Header : mode + badges + status connexion + menu ──
        header = tk.Frame(frame, bg=COLORS["card"], height=60)
        header.pack(fill="x", padx=8, pady=(8, 0))
        header.pack_propagate(False)

        self._mode_label = tk.Label(
            header, text="- RETRAIT", bg=COLORS["card"],
            fg=COLORS["error"], font=("Helvetica", 22, "bold"),
        )
        self._mode_label.pack(side="left", padx=16)

        self._menu_btn = tk.Button(
            header, text="☰", bg=COLORS["card"], fg=COLORS["text"],
            font=("Helvetica", 18, "bold"), relief="flat",
            activebackground=COLORS["border"],
            command=lambda: self._navigate("menu"),
        )
        self._menu_btn.pack(side="right", padx=(4, 12))

        self._status_dot = tk.Label(
            header, text="●", bg=COLORS["card"], fg=COLORS["success"], font=("Helvetica", 18)
        )
        self._status_dot.pack(side="right", padx=8)

        self._status_label = tk.Label(
            header, text="Connecté", bg=COLORS["card"],
            fg=COLORS["success"], font=("Helvetica", 14),
        )
        self._status_label.pack(side="right", padx=4)

        self._lowstock_badge = tk.Label(
            header, text="", bg=COLORS["card"], fg=COLORS["warning"],
            font=("Helvetica", 14, "bold"), cursor="hand2",
        )
        self._lowstock_badge.pack(side="right", padx=12)
        self._lowstock_badge.bind("<Button-1>", lambda e: self._navigate("stockbas"))

        self._batch_label = tk.Label(
            header, text="Batch —", bg=COLORS["card"],
            fg=COLORS["muted"], font=("Helvetica", 13),
        )
        self._batch_label.pack(side="right", padx=20)

        # ── Zone produit (centre) ──
        product_frame = tk.Frame(frame, bg=COLORS["card"], relief="flat")
        product_frame.pack(fill="both", expand=True, padx=8, pady=8)

        self._product_name = tk.Label(
            product_frame, text="En attente de scan...",
            bg=COLORS["card"], fg=COLORS["text"],
            font=("Helvetica", 28, "bold"), wraplength=W - 80,
        )
        self._product_name.pack(pady=(24, 4))

        self._product_detail = tk.Label(
            product_frame, text="",
            bg=COLORS["card"], fg=COLORS["muted"],
            font=("Helvetica", 18),
        )
        self._product_detail.pack()

        self._stock_label = tk.Label(
            product_frame, text="",
            bg=COLORS["card"], fg=COLORS["accent"],
            font=("Helvetica", 22, "bold"),
        )
        self._stock_label.pack(pady=8)

        self._scan_count = tk.Label(
            product_frame, text="0 scan(s) aujourd'hui",
            bg=COLORS["card"], fg=COLORS["muted"],
            font=("Helvetica", 13),
        )
        self._scan_count.pack(pady=(0, 8))

        # ── Barre de message (erreurs / confirmations) ──
        self._msg_bar = tk.Label(
            frame, text="", bg=COLORS["bg"],
            fg=COLORS["warning"], font=("Helvetica", 14),
        )
        self._msg_bar.pack(fill="x", padx=8)

        # ── Boutons tactiles bas de page ──
        btn_frame = tk.Frame(frame, bg=COLORS["bg"])
        btn_frame.pack(fill="x", padx=8, pady=(0, 8))

        btn_cfg = [
            ("＋ AJOUT",   "plus",  COLORS["success"]),
            ("－ RETRAIT", "minus", COLORS["error"]),
            ("＝ SET",     "set",   COLORS["warning"]),
        ]
        for label, mode, color in btn_cfg:
            tk.Button(
                btn_frame, text=label, bg=color, fg="white",
                font=("Helvetica", 16, "bold"),
                relief="flat", activebackground=color,
                command=lambda m=mode: self._on_mode_change(m),
                height=2,
            ).pack(side="left", expand=True, fill="x", padx=4)

    # ── Écran Menu ────────────────────────────────────────────────────────────

    def _build_menu_screen(self):
        frame = tk.Frame(self._container, bg=COLORS["bg"])
        frame.grid(row=0, column=0, sticky="nsew")
        self._screens["menu"] = frame

        tk.Label(
            frame, text="Menu", bg=COLORS["bg"], fg=COLORS["text"],
            font=("Helvetica", 26, "bold"),
        ).pack(pady=(32, 24))

        items = [
            ("🏠 Retour au scan",     "scan"),
            ("📦 Inventaire",         "inventaire"),
            ("⚠ Stock bas",           "stockbas"),
            ("🚚 Commandes à venir",  "avenir"),
            ("🕒 Historique",         "historique"),
        ]
        for label, screen in items:
            tk.Button(
                frame, text=label, bg=COLORS["card"], fg="white",
                font=("Helvetica", 18, "bold"), relief="flat",
                activebackground=COLORS["border"],
                command=lambda s=screen: self._navigate(s),
                height=2,
            ).pack(fill="x", padx=40, pady=8)

        tk.Button(
            frame, text="⟳ Nouveau batch", bg=COLORS["card"], fg="white",
            font=("Helvetica", 18, "bold"), relief="flat",
            activebackground=COLORS["border"],
            command=self._trigger_new_batch,
            height=2,
        ).pack(fill="x", padx=40, pady=8)

    # ── Écrans de consultation (liste paginée générique) ─────────────────────

    def _build_list_screen(self, key: str, title: str, header_text: str, *,
                            clickable: bool, back_target: str, show_refresh: bool):
        frame = tk.Frame(self._container, bg=COLORS["bg"])
        frame.grid(row=0, column=0, sticky="nsew")
        self._screens[key] = frame

        topbar = tk.Frame(frame, bg=COLORS["card"], height=56)
        topbar.pack(fill="x", padx=8, pady=(8, 0))
        topbar.pack_propagate(False)

        back_label = "☰ Menu" if back_target == "menu" else "← Historique"
        tk.Button(
            topbar, text=back_label, bg=COLORS["accent"], fg="white",
            font=("Helvetica", 13, "bold"), relief="flat",
            command=lambda t=back_target: self._navigate(t),
        ).pack(side="left", padx=8, pady=8)

        title_label = tk.Label(
            topbar, text=title, bg=COLORS["card"], fg=COLORS["text"],
            font=("Helvetica", 18, "bold"),
        )
        title_label.pack(side="left", padx=16)

        updated_label = tk.Label(
            topbar, text="", bg=COLORS["card"], fg=COLORS["muted"], font=("Helvetica", 11),
        )
        updated_label.pack(side="right", padx=8)

        if show_refresh:
            tk.Button(
                topbar, text="⟳ Rafraîchir", bg=COLORS["muted"], fg="white",
                font=("Helvetica", 12, "bold"), relief="flat",
                command=lambda k=key: self._refresh(k),
            ).pack(side="right", padx=8, pady=8)

        tk.Label(
            frame, text=header_text, bg=COLORS["bg"], fg=COLORS["muted"],
            font=("Courier", 12, "bold"), anchor="w", justify="left",
        ).pack(fill="x", padx=16, pady=(8, 2))

        body = tk.Frame(frame, bg=COLORS["bg"])
        body.pack(fill="both", expand=True, padx=8)

        row_labels = []
        for _ in range(LIST_PAGE_SIZE):
            lbl = tk.Label(
                body, text="", bg=COLORS["card"], fg=COLORS["text"],
                font=("Courier", 13), anchor="w", justify="left",
            )
            lbl.pack(fill="x", padx=8, pady=1)
            row_labels.append(lbl)

        footer = tk.Frame(frame, bg=COLORS["bg"], height=50)
        footer.pack(fill="x", padx=8, pady=(0, 8))
        footer.pack_propagate(False)

        tk.Button(
            footer, text="◀ Précédent", bg=COLORS["card"], fg="white",
            font=("Helvetica", 13, "bold"), relief="flat",
            command=lambda k=key: self._change_page(k, -1),
        ).pack(side="left", padx=4, expand=True, fill="x")

        page_label = tk.Label(
            footer, text="Page —", bg=COLORS["bg"], fg=COLORS["muted"], font=("Helvetica", 13),
        )
        page_label.pack(side="left", padx=12)

        tk.Button(
            footer, text="Suivant ▶", bg=COLORS["card"], fg="white",
            font=("Helvetica", 13, "bold"), relief="flat",
            command=lambda k=key: self._change_page(k, 1),
        ).pack(side="left", padx=4, expand=True, fill="x")

        self._lists[key] = {
            "data": [], "page": 0, "row_labels": row_labels,
            "page_label": page_label, "updated_label": updated_label,
            "title_label": title_label, "clickable": clickable,
        }

    # ── Navigation (toujours appelée depuis le thread principal tkinter) ─────

    def _show(self, name: str):
        self._screens[name].tkraise()
        self._current = name

    def _navigate(self, name: str):
        self._show(name)
        if name in self._lists:
            self._refresh(name)

    def _refresh(self, key: str):
        self._set_loading(key)
        self._on_navigate(key)

    def _trigger_new_batch(self):
        """Depuis le menu : envoie les scans en attente puis revient à l'écran de scan
        pour que l'employé voie la confirmation (numéro de batch, compteur à 0)."""
        self._on_new_batch()
        self._navigate("scan")

    def _set_loading(self, key: str):
        st = self._lists[key]
        st["row_labels"][0].config(text="Chargement...", fg=COLORS["muted"])
        for lbl in st["row_labels"][1:]:
            lbl.config(text="", fg=COLORS["muted"])
        st["page_label"].config(text="Page —")

    def _open_batch_detail(self, batch_id: int):
        self._lists["historique_detail"]["title_label"].config(text=f"Batch #{batch_id}")
        self._show("historique_detail")
        self._set_loading("historique_detail")
        self._on_open_batch_detail(batch_id)

    def _change_page(self, key: str, delta: int):
        st = self._lists[key]
        total_pages = max(1, -(-len(st["data"]) // LIST_PAGE_SIZE))
        st["page"] = min(max(0, st["page"] + delta), total_pages - 1)
        self._render_list(key)

    def _render_list(self, key: str):
        st = self._lists[key]
        data = st["data"]
        total_pages = max(1, -(-len(data) // LIST_PAGE_SIZE))
        page = min(st["page"], total_pages - 1)
        st["page"] = page
        start = page * LIST_PAGE_SIZE
        chunk = data[start:start + LIST_PAGE_SIZE]

        formatter = FORMATTERS[key]
        for i, lbl in enumerate(st["row_labels"]):
            if i < len(chunk):
                text, item_id, color = formatter(chunk[i])
                lbl.config(text=text, fg=color)
                if st["clickable"] and item_id is not None:
                    lbl.config(cursor="hand2")
                    lbl.bind("<Button-1>", lambda e, bid=item_id: self._open_batch_detail(bid))
                else:
                    lbl.unbind("<Button-1>")
                    lbl.config(cursor="arrow")
            else:
                lbl.config(text="Aucune donnée." if (i == 0 and not data) else "", fg=COLORS["muted"])
                lbl.unbind("<Button-1>")
                lbl.config(cursor="arrow")

        st["page_label"].config(text=f"Page {page + 1}/{total_pages}  ({len(data)} au total)")

    # ── API publique (thread-safe via queue) ──────────────────────────────────

    def update_scan(self, product_name: str, detail: str,
                    stock_before: int, stock_after: int, scan_count: int):
        self._update_queue.put(("scan", product_name, detail, stock_before, stock_after, scan_count))

    def update_mode(self, mode: str):
        self._update_queue.put(("mode", mode))

    def update_status(self, online: bool, pending: int):
        self._update_queue.put(("status", online, pending))

    def update_batch(self, batch_id: int | None, scan_count: int):
        self._update_queue.put(("batch", batch_id, scan_count))

    def update_lowstock_badge(self, count: int):
        self._update_queue.put(("lowstock", count))

    def show_error(self, msg: str):
        self._update_queue.put(("error", msg))

    def show_unknown(self, barcode: str):
        self._update_queue.put(("unknown", barcode))

    def set_list_data(self, key: str, items: list[dict]):
        """Alimente un écran de consultation (inventaire/stockbas/avenir/historique/
        historique_detail) depuis un thread de fond, une fois les données récupérées."""
        self._update_queue.put(("listdata", key, items))

    # ── Traitement des updates (thread principal tkinter) ─────────────────────

    def _process_updates(self):
        try:
            while True:
                item = self._update_queue.get_nowait()
                self._apply_update(item)
        except queue.Empty:
            pass
        self.root.after(100, self._process_updates)

    def _apply_update(self, item):
        kind = item[0]

        if kind == "scan":
            _, name, detail, before, after, count = item
            self._product_name.config(text=name, fg=COLORS["text"])
            self._product_detail.config(text=detail)
            diff = after - before
            sign = "+" if diff >= 0 else ""
            self._stock_label.config(
                text=f"Stock : {before} → {after}  ({sign}{diff})",
                fg=COLORS["success"] if diff >= 0 else COLORS["error"],
            )
            self._scan_count.config(text=f"{count} scan(s) aujourd'hui")
            self._msg_bar.config(text="", fg=COLORS["warning"])

        elif kind == "mode":
            mode = item[1]
            label, color = MODE_LABELS.get(mode, ("?", COLORS["muted"]))
            self._mode_label.config(text=label, fg=color)

        elif kind == "status":
            _, online, pending = item
            if online:
                dot_color = COLORS["success"]
                status_text = "Connecté"
                if pending > 0:
                    status_text = f"Connecté ({pending} en attente)"
                    dot_color = COLORS["warning"]
            else:
                dot_color = COLORS["error"]
                status_text = f"Hors ligne ({pending} en attente)"
            self._status_dot.config(fg=dot_color)
            self._status_label.config(text=status_text, fg=dot_color)

        elif kind == "batch":
            _, batch_id, count = item
            if batch_id:
                self._batch_label.config(text=f"Batch #{batch_id} · {count} scans")
            else:
                self._batch_label.config(text="Batch —")

        elif kind == "lowstock":
            count = item[1]
            if count > 0:
                self._lowstock_badge.config(text=f"⚠ {count} stock bas")
            else:
                self._lowstock_badge.config(text="")

        elif kind == "error":
            self._msg_bar.config(text=f"⚠ {item[1]}", fg=COLORS["error"])

        elif kind == "unknown":
            barcode = item[1]
            self._product_name.config(text="Produit non référencé", fg=COLORS["warning"])
            self._product_detail.config(text=barcode)
            self._stock_label.config(text="")
            self._msg_bar.config(
                text="Code inconnu — à ajouter dans Bellenode", fg=COLORS["warning"]
            )

        elif kind == "listdata":
            _, key, items = item
            st = self._lists[key]
            st["data"] = items or []
            st["page"] = 0
            st["updated_label"].config(text=f"Maj {datetime.now().strftime('%H:%M:%S')}")
            self._render_list(key)

    def run(self):
        self.root.mainloop()
