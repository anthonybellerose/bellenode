"""
Interface tkinter pour écran tactile Raspberry Pi.
Conçu pour 800×480 (écran officiel 7²).

Écrans : Scan (accueil) ⇄ Menu ⇄ Inventaire / Stock bas / Commandes à venir /
Historique (→ détail d'un batch). Navigation par un bouton "☰ Menu" unique,
présent sur l'écran de scan et chaque écran de consultation.

Photos produits (Inventaire, Commandes à venir, écran Scan) : affichées depuis
le cache disque local (image_cache.get_cached_path, lecture instantanée). Si
absente du cache, un placeholder s'affiche tout de suite et le téléchargement
est délégué à main.py en arrière-plan (on_request_image) — jamais de réseau
sur le thread tkinter.
"""
import queue
import tkinter as tk
from datetime import datetime
from typing import Callable

from PIL import Image, ImageTk

import config
import image_cache

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

IMG_THUMB_PX = 44     # vignette dans les listes
SCAN_IMG_PX = 150     # photo sur l'écran de scan
PLACEHOLDER_TEXT = "📦"
PLACEHOLDER_FAILED = "🚫"

# Écran Inventaire (défilement + recherche) — priorité à la lisibilité (grandes
# vignettes/texte), donc moins de lignes visibles à la fois qu'un écran dense.
INV_IMG_PX = 42
INV_ROWS_NORMAL = 6     # lignes visibles quand le clavier est fermé
INV_SCROLL_STEP = 2     # lignes parcourues par appui sur ▲/▼
INV_KEYBOARD_H = 260    # hauteur du clavier — posé PAR-DESSUS le bas de la liste
                        # (place, pas pack) : les lignes ne disparaissent jamais,
                        # elles sont juste couvertes, pour un effet plus fluide.


# ── Formatage des lignes de liste : chaque formatter retourne un dict avec
# text/id/color/image_code/image_url (les deux derniers None si pas d'image) ──

def _fmt_money(v) -> str:
    return f"${v:,.2f}" if v is not None else "—"


def _fmt_dt(iso: str | None) -> str:
    if not iso:
        return "—"
    try:
        return iso.split(".")[0].replace("T", " ")[:16]
    except Exception:
        return str(iso)[:16]


def _row_inventaire(item: dict) -> dict:
    code = item.get("code")
    nom = (item.get("nom") or code or "?")[:30]
    qty = item.get("quantite", 0)
    prix = _fmt_money(item.get("prix"))
    return {"text": f"{nom:<30} {qty:>5}  {prix:>7}", "id": None, "color": COLORS["text"],
            "image_code": code, "image_url": item.get("imageUrl")}


def _row_stockbas(item: dict) -> dict:
    nom = (item.get("nom") or item.get("code") or "?")[:26]
    qty = item.get("qtyActuelle", 0)
    minq = item.get("minQty") or 0
    rupture = item.get("statut") == "rupture"
    statut = "RUPTURE" if rupture else "BAS"
    color = COLORS["error"] if rupture else COLORS["warning"]
    return {"text": f"{nom:<26} {qty:>6}  min {minq:>4}  {statut}", "id": None, "color": color,
            "image_code": None, "image_url": None}


def _row_avenir(item: dict) -> dict:
    code = item.get("code")
    nom = (item.get("nom") or code or "?")[:26]
    qty = item.get("qtyActuelle", 0)
    pend = item.get("qtyPending") or 0
    return {"text": f"{nom:<26} actuel {qty:>4}  en route {pend:>4}", "id": None, "color": COLORS["accent"],
            "image_code": code, "image_url": item.get("imageUrl")}


def _row_historique(item: dict) -> dict:
    dt = _fmt_dt(item.get("createdAt"))
    who = (item.get("createdBy") or "—")[:12]
    mvmt = f"+{item.get('totalAjouts', 0)}/-{item.get('totalRetraits', 0)}"
    produits = item.get("produitsTouches", 0)
    return {"text": f"{dt:<16} {who:<12} {mvmt:>8}  {produits} prod.", "id": item.get("id"),
            "color": COLORS["text"], "image_code": None, "image_url": None}


def _row_operation(op: dict) -> dict:
    symbol, color = BATCH_MODE_SYMBOLS.get(op.get("mode"), ("?", COLORS["muted"]))
    nom = (op.get("nom") or op.get("code") or "?")[:26]
    avant = op.get("qtyAvant", 0)
    apres = op.get("qtyApres", 0)
    return {"text": f"{symbol} {nom:<26} {avant:>4} → {apres:<4}", "id": None, "color": color,
            "image_code": None, "image_url": None}


FORMATTERS = {
    "inventaire":        _row_inventaire,
    "stockbas":          _row_stockbas,
    "avenir":            _row_avenir,
    "historique":        _row_historique,
    "historique_detail": _row_operation,
}

LIST_SCREENS = [
    dict(key="stockbas", title="Stock bas",
         header_text=f"{'Produit':<26} {'Actuel':>6}  {'Min':>4}   Statut",
         clickable=False, back_target="menu", show_refresh=True,
         with_image=False, page_size=8),
    dict(key="avenir", title="Commandes à venir",
         header_text=f"{'Produit':<26} actuel {'':>4}  en route",
         clickable=False, back_target="menu", show_refresh=True,
         with_image=True, page_size=5),
    dict(key="historique", title="Historique",
         header_text=f"{'Date/heure':<16} {'Par':<12} {'Mvmt':>8}  Produits",
         clickable=True, back_target="menu", show_refresh=True,
         with_image=False, page_size=8),
    dict(key="historique_detail", title="Détail du batch",
         header_text=f"  {'Produit':<26} {'Avant':>4}   Après",
         clickable=False, back_target="historique", show_refresh=False,
         with_image=False, page_size=8),
]


class RaspberryUI:
    def __init__(self, on_mode_change: Callable[[str], None],
                 on_new_batch: Callable[[], None],
                 on_navigate: Callable[[str], None],
                 on_open_batch_detail: Callable[[int], None],
                 on_request_image: Callable[[str, str], None]):
        self._on_mode_change = on_mode_change
        self._on_new_batch = on_new_batch
        self._on_navigate = on_navigate
        self._on_open_batch_detail = on_open_batch_detail
        self._on_request_image = on_request_image
        self._update_queue: queue.Queue = queue.Queue()

        self._lists: dict[str, dict] = {}
        self._screens: dict[str, tk.Frame] = {}
        self._scan_image_code: str | None = None

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
        self._build_inventaire_screen()
        for spec in LIST_SCREENS:
            self._build_list_screen(**spec)

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

        img_container = tk.Frame(product_frame, bg=COLORS["card"], width=SCAN_IMG_PX, height=SCAN_IMG_PX)
        img_container.pack(pady=(16, 4))
        img_container.pack_propagate(False)
        self._scan_image_label = tk.Label(
            img_container, bg=COLORS["card"], fg=COLORS["muted"],
            text=PLACEHOLDER_TEXT, font=("Helvetica", 40),
        )
        self._scan_image_label.pack(fill="both", expand=True)

        self._product_name = tk.Label(
            product_frame, text="En attente de scan...",
            bg=COLORS["card"], fg=COLORS["text"],
            font=("Helvetica", 28, "bold"), wraplength=W - 80,
        )
        self._product_name.pack(pady=(4, 4))

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

    # ── Écran Inventaire (défilement + recherche + tri, pas de pagination) ───

    def _build_inventaire_screen(self):
        frame = tk.Frame(self._container, bg=COLORS["bg"])
        frame.grid(row=0, column=0, sticky="nsew")
        self._screens["inventaire"] = frame

        topbar = tk.Frame(frame, bg=COLORS["card"], height=44)
        topbar.pack(fill="x", padx=6, pady=(6, 0))
        topbar.pack_propagate(False)

        tk.Button(
            topbar, text="☰ Menu", bg=COLORS["accent"], fg="white",
            font=("Helvetica", 12, "bold"), relief="flat",
            command=lambda: self._navigate("menu"),
        ).pack(side="left", padx=6, pady=5)

        title_label = tk.Label(
            topbar, text="Inventaire", bg=COLORS["card"], fg=COLORS["text"],
            font=("Helvetica", 15, "bold"),
        )
        title_label.pack(side="left", padx=10)

        updated_label = tk.Label(
            topbar, text="", bg=COLORS["card"], fg=COLORS["muted"], font=("Helvetica", 9),
        )
        updated_label.pack(side="right", padx=6)

        tk.Button(
            topbar, text="⟳", bg=COLORS["muted"], fg="white",
            font=("Helvetica", 12, "bold"), relief="flat",
            command=lambda: self._refresh("inventaire"),
        ).pack(side="right", padx=4, pady=5)

        # ── Barre outils : recherche + tri ──
        toolbar = tk.Frame(frame, bg=COLORS["card"], height=32)
        toolbar.pack(fill="x", padx=6, pady=(3, 0))
        toolbar.pack_propagate(False)

        search_label = tk.Label(
            toolbar, text="🔍 Rechercher...", bg=COLORS["card"], fg=COLORS["muted"],
            font=("Helvetica", 12), anchor="w", cursor="hand2",
        )
        search_label.pack(side="left", fill="both", expand=True, padx=8)
        search_label.bind("<Button-1>", lambda e: self._inv_search_open())

        sort_btn = tk.Button(
            toolbar, text="🕒 Récent", bg=COLORS["accent"], fg="white",
            font=("Helvetica", 11, "bold"), relief="flat",
            command=self._inv_toggle_sort,
        )
        sort_btn.pack(side="right", padx=5, pady=3)

        header_row = tk.Frame(frame, bg=COLORS["bg"])
        header_row.pack(fill="x", padx=14, pady=(4, 0))
        tk.Frame(header_row, bg=COLORS["bg"], width=INV_IMG_PX + 10).pack(side="left")
        tk.Label(
            header_row, text=f"{'Produit':<26} {'Qté':>5}  {'Prix':>7}",
            bg=COLORS["bg"], fg=COLORS["muted"], font=("Courier", 10, "bold"),
            anchor="w", justify="left",
        ).pack(side="left", fill="x", expand=True)

        body = tk.Frame(frame, bg=COLORS["bg"])
        body.pack(fill="both", expand=True, padx=6)
        rows = [self._build_row(body, True, img_px=INV_IMG_PX, pady=2, font_size=15)
                for _ in range(INV_ROWS_NORMAL)]

        footer = tk.Frame(frame, bg=COLORS["bg"], height=40)
        footer.pack(fill="x", padx=6, pady=(0, 6))
        footer.pack_propagate(False)

        tk.Button(
            footer, text="▲", bg=COLORS["card"], fg="white",
            font=("Helvetica", 13, "bold"), relief="flat",
            command=lambda: self._inv_scroll(-1),
        ).pack(side="left", padx=3, expand=True, fill="x")

        pos_label = tk.Label(
            footer, text="0 / 0", bg=COLORS["bg"], fg=COLORS["muted"], font=("Helvetica", 11),
        )
        pos_label.pack(side="left", padx=8)

        tk.Button(
            footer, text="▼", bg=COLORS["card"], fg="white",
            font=("Helvetica", 13, "bold"), relief="flat",
            command=lambda: self._inv_scroll(1),
        ).pack(side="left", padx=3, expand=True, fill="x")

        # ── Clavier tactile : posé PAR-DESSUS le bas de l'écran avec place()
        # plutôt que pack() — les lignes/toolbar/footer en dessous restent
        # entièrement en place (rien n'est retiré ni ne se réorganise), le
        # clavier vient juste les couvrir visuellement. Plus fluide qu'un
        # pack_forget qui faisait "disparaître"/sauter le contenu à l'ouverture.
        keyboard_frame = tk.Frame(frame, bg=COLORS["bg"], highlightthickness=0)

        kb_search_label = tk.Label(
            keyboard_frame, text="🔍 Rechercher...", bg=COLORS["card"], fg=COLORS["text"],
            font=("Helvetica", 15, "bold"), anchor="w",
        )
        kb_search_label.pack(fill="x", padx=6, pady=(0, 6), ipady=6)

        key_rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]
        for i, letters in enumerate(key_rows):
            row_f = tk.Frame(keyboard_frame, bg=COLORS["bg"])
            row_f.pack(fill="both", expand=True, pady=2)
            for ch in letters:
                tk.Button(
                    row_f, text=ch, bg=COLORS["card"], fg="white",
                    font=("Helvetica", 14, "bold"), relief="flat",
                    command=lambda c=ch: self._inv_search_key(c),
                ).pack(side="left", expand=True, fill="both", padx=2)
            if i == len(key_rows) - 1:
                tk.Button(
                    row_f, text="⌫", bg=COLORS["muted"], fg="white",
                    font=("Helvetica", 14, "bold"), relief="flat",
                    command=self._inv_search_backspace,
                ).pack(side="left", expand=True, fill="both", padx=2)

        bottom_row = tk.Frame(keyboard_frame, bg=COLORS["bg"])
        bottom_row.pack(fill="both", expand=True, pady=2)
        tk.Button(
            bottom_row, text="␣ Espace", bg=COLORS["card"], fg="white",
            font=("Helvetica", 14, "bold"), relief="flat",
            command=lambda: self._inv_search_key(" "),
        ).pack(side="left", expand=True, fill="both", padx=2)
        tk.Button(
            bottom_row, text="✕ Effacer", bg=COLORS["error"], fg="white",
            font=("Helvetica", 14, "bold"), relief="flat",
            command=self._inv_search_clear,
        ).pack(side="left", expand=True, fill="both", padx=2)
        tk.Button(
            bottom_row, text="✓ Fermer", bg=COLORS["success"], fg="white",
            font=("Helvetica", 14, "bold"), relief="flat",
            command=self._inv_search_close,
        ).pack(side="left", expand=True, fill="both", padx=2)

        self._lists["inventaire"] = {
            "data": [], "filtered": [], "offset": 0, "search": "", "search_mode": False,
            "sort": "recent", "rows": rows, "updated_label": updated_label,
            "title_label": title_label, "with_image": True, "clickable": False,
            "pos_label": pos_label, "search_label": search_label, "sort_btn": sort_btn,
            "keyboard_frame": keyboard_frame, "toolbar": toolbar, "header_row": header_row,
            "footer": footer, "kb_search_label": kb_search_label, "body": body,
        }

    def _inv_toggle_sort(self):
        st = self._lists["inventaire"]
        st["sort"] = "alpha" if st["sort"] == "recent" else "recent"
        st["sort_btn"].config(text="🔤 A-Z" if st["sort"] == "alpha" else "🕒 Récent")
        self._inv_recompute()

    def _inv_search_open(self):
        st = self._lists["inventaire"]
        st["search_mode"] = True
        st["keyboard_frame"].place(relx=0, rely=1.0, anchor="sw", relwidth=1.0, height=INV_KEYBOARD_H)
        st["keyboard_frame"].lift()
        self._inv_update_search_label()

    def _inv_search_close(self):
        st = self._lists["inventaire"]
        st["search_mode"] = False
        st["keyboard_frame"].place_forget()

    def _inv_search_key(self, c: str):
        st = self._lists["inventaire"]
        st["search"] += c
        self._inv_update_search_label()
        self._inv_recompute()

    def _inv_search_backspace(self):
        st = self._lists["inventaire"]
        st["search"] = st["search"][:-1]
        self._inv_update_search_label()
        self._inv_recompute()

    def _inv_search_clear(self):
        st = self._lists["inventaire"]
        st["search"] = ""
        self._inv_update_search_label()
        self._inv_recompute()

    def _inv_update_search_label(self):
        st = self._lists["inventaire"]
        text = st["search"]
        label_text = f"🔍 {text}" if text else "🔍 Rechercher..."
        color = COLORS["text"] if text else COLORS["muted"]
        st["search_label"].config(text=label_text, fg=color)
        st["kb_search_label"].config(text=label_text, fg=color)

    def _inv_recompute(self):
        """Recalcule la liste filtrée/triée à partir des données déjà en mémoire —
        aucun appel réseau, tout se fait sur les données récupérées au dernier
        rafraîchissement (l'inventaire réel ne fait qu'une centaine de lignes)."""
        st = self._lists["inventaire"]
        search = st["search"].strip().lower()
        data = st["data"]
        if search:
            filtered = [d for d in data if search in (d.get("nom") or "").lower()]
        else:
            filtered = list(data)
        if st["sort"] == "alpha":
            filtered.sort(key=lambda d: (d.get("nom") or "").lower())
        else:
            filtered.sort(key=lambda d: d.get("updatedAt") or "", reverse=True)
        st["filtered"] = filtered
        st["offset"] = 0
        self._inv_render()

    def _inv_scroll(self, direction: int):
        st = self._lists["inventaire"]
        max_offset = max(0, len(st["filtered"]) - INV_ROWS_NORMAL)
        st["offset"] = min(max(0, st["offset"] + direction * INV_SCROLL_STEP), max_offset)
        self._inv_render()

    def _inv_render(self):
        st = self._lists["inventaire"]
        filtered = st["filtered"]
        max_offset = max(0, len(filtered) - INV_ROWS_NORMAL)
        offset = min(st["offset"], max_offset)
        st["offset"] = offset
        chunk = filtered[offset:offset + INV_ROWS_NORMAL]

        for i, row in enumerate(st["rows"]):
            if i < len(chunk):
                f = _row_inventaire(chunk[i])
                row["text_label"].config(text=f["text"], fg=f["color"])
                self._set_row_image(row, f["image_code"], f["image_url"])
            else:
                empty_msg = "Aucun résultat." if (i == 0 and st["search"]) else \
                            ("Aucune donnée." if (i == 0 and not filtered) else "")
                row["text_label"].config(text=empty_msg, fg=COLORS["muted"])
                self._set_row_image(row, None, None)

        if filtered:
            shown_end = min(offset + INV_ROWS_NORMAL, len(filtered))
            st["pos_label"].config(text=f"{offset + 1}-{shown_end} / {len(filtered)}")
        else:
            st["pos_label"].config(text="0 / 0")

    # ── Écrans de consultation (liste paginée générique) ─────────────────────

    def _build_row(self, parent: tk.Widget, with_image: bool, img_px: int = IMG_THUMB_PX,
                    pady: int = 2, font_size: int = 13) -> dict:
        row_frame = tk.Frame(parent, bg=COLORS["card"])
        row_frame.pack(fill="x", padx=8, pady=pady if with_image else 1)

        img_label = None
        if with_image:
            img_container = tk.Frame(row_frame, bg=COLORS["card"], width=img_px, height=img_px)
            img_container.pack(side="left", padx=(4, 8), pady=3)
            img_container.pack_propagate(False)
            img_label = tk.Label(
                img_container, bg=COLORS["card"], fg=COLORS["muted"],
                text=PLACEHOLDER_TEXT, font=("Helvetica", font_size),
            )
            img_label.pack(fill="both", expand=True)

        text_label = tk.Label(
            row_frame, text="", bg=COLORS["card"], fg=COLORS["text"],
            font=("Courier", font_size), anchor="w", justify="left",
        )
        text_label.pack(side="left", fill="both", expand=True, pady=1)

        return {"frame": row_frame, "img_label": img_label, "text_label": text_label,
                "code": None, "img_px": img_px, "row_pady": pady}

    def _build_list_screen(self, key: str, title: str, header_text: str, *,
                            clickable: bool, back_target: str, show_refresh: bool,
                            with_image: bool, page_size: int):
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

        header_row = tk.Frame(frame, bg=COLORS["bg"])
        header_row.pack(fill="x", padx=16, pady=(8, 2))
        if with_image:
            tk.Frame(header_row, bg=COLORS["bg"], width=IMG_THUMB_PX + 12).pack(side="left")
        tk.Label(
            header_row, text=header_text, bg=COLORS["bg"], fg=COLORS["muted"],
            font=("Courier", 12, "bold"), anchor="w", justify="left",
        ).pack(side="left", fill="x", expand=True)

        body = tk.Frame(frame, bg=COLORS["bg"])
        body.pack(fill="both", expand=True, padx=8)

        rows = [self._build_row(body, with_image) for _ in range(page_size)]

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
            "data": [], "page": 0, "page_size": page_size, "rows": rows,
            "page_label": page_label, "updated_label": updated_label,
            "title_label": title_label, "clickable": clickable, "with_image": with_image,
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
        for i, row in enumerate(st["rows"]):
            row["text_label"].config(text="Chargement..." if i == 0 else "", fg=COLORS["muted"])
            row["code"] = None
            if row["img_label"] is not None:
                row["img_label"].config(image="", text="")
                row["img_label"].image = None
        if key == "inventaire":
            st["pos_label"].config(text="—")
        else:
            st["page_label"].config(text="Page —")

    def _open_batch_detail(self, batch_id: int):
        self._lists["historique_detail"]["title_label"].config(text=f"Batch #{batch_id}")
        self._show("historique_detail")
        self._set_loading("historique_detail")
        self._on_open_batch_detail(batch_id)

    def _change_page(self, key: str, delta: int):
        st = self._lists[key]
        total_pages = max(1, -(-len(st["data"]) // st["page_size"]))
        st["page"] = min(max(0, st["page"] + delta), total_pages - 1)
        self._render_list(key)

    def _render_list(self, key: str):
        st = self._lists[key]
        data = st["data"]
        page_size = st["page_size"]
        total_pages = max(1, -(-len(data) // page_size))
        page = min(st["page"], total_pages - 1)
        st["page"] = page
        start = page * page_size
        chunk = data[start:start + page_size]

        formatter = FORMATTERS[key]
        for i, row in enumerate(st["rows"]):
            text_label = row["text_label"]
            if i < len(chunk):
                f = formatter(chunk[i])
                text_label.config(text=f["text"], fg=f["color"])
                item_id = f["id"]
                if st["clickable"] and item_id is not None:
                    text_label.config(cursor="hand2")
                    text_label.bind("<Button-1>", lambda e, bid=item_id: self._open_batch_detail(bid))
                else:
                    text_label.unbind("<Button-1>")
                    text_label.config(cursor="arrow")
                if row["img_label"] is not None:
                    self._set_row_image(row, f["image_code"], f["image_url"])
            else:
                text_label.config(text="Aucune donnée." if (i == 0 and not data) else "", fg=COLORS["muted"])
                text_label.unbind("<Button-1>")
                text_label.config(cursor="arrow")
                if row["img_label"] is not None:
                    self._set_row_image(row, None, None)

        st["page_label"].config(text=f"Page {page + 1}/{total_pages}  ({len(data)} au total)")

    # ── Photos produits ────────────────────────────────────────────────────────

    def _load_photo(self, path: str, size: tuple[int, int]) -> ImageTk.PhotoImage | None:
        try:
            img = Image.open(path).convert("RGB")
            img.thumbnail(size)
            return ImageTk.PhotoImage(img)
        except Exception:
            return None

    def _set_row_image(self, row: dict, code: str | None, url: str | None):
        """Affiche l'image en cache si dispo, sinon un placeholder + demande de
        téléchargement en arrière-plan (jamais de réseau ici, thread tkinter)."""
        row["code"] = code
        lbl = row["img_label"]
        if not code:
            lbl.config(image="", text="")
            lbl.image = None
            return
        cached = image_cache.get_cached_path(code)
        if cached:
            px = row["img_px"] - 4
            photo = self._load_photo(cached, (px, px))
            if photo:
                lbl.config(image=photo, text="")
                lbl.image = photo
                return
        lbl.config(image="", text=PLACEHOLDER_TEXT)
        lbl.image = None
        if url:
            self._on_request_image(code, url)

    def _apply_image_ready(self, code: str, path: str | None):
        """Un téléchargement d'image demandé plus tôt vient de se terminer (succès ou
        échec) — applique le résultat à tout ce qui affiche encore ce produit."""
        for st in self._lists.values():
            if not st["with_image"]:
                continue
            for row in st["rows"]:
                if row["code"] != code:
                    continue
                px = row["img_px"] - 4
                photo = self._load_photo(path, (px, px)) if path else None
                if photo:
                    row["img_label"].config(image=photo, text="")
                    row["img_label"].image = photo
                else:
                    row["img_label"].config(image="", text=PLACEHOLDER_FAILED)
                    row["img_label"].image = None

        if self._scan_image_code == code:
            photo = self._load_photo(path, (SCAN_IMG_PX - 8, SCAN_IMG_PX - 8)) if path else None
            if photo:
                self._scan_image_label.config(image=photo, text="")
                self._scan_image_label.image = photo
            else:
                self._scan_image_label.config(image="", text=PLACEHOLDER_FAILED)
                self._scan_image_label.image = None

    # ── API publique (thread-safe via queue) ──────────────────────────────────

    def update_scan(self, product_name: str, detail: str,
                    stock_before: int, stock_after: int, scan_count: int):
        self._update_queue.put(("scan", product_name, detail, stock_before, stock_after, scan_count))

    def update_scan_image(self, code: str, cached_path: str | None):
        """Photo du produit qui vient d'être scanné — cached_path est déjà résolu par
        main.py (lecture disque, image_cache.get_cached_path), ceci ne fait que l'afficher."""
        self._update_queue.put(("scanimage", code, cached_path))

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

    def set_image_ready(self, code: str, path: str | None):
        """Appelé depuis main.py une fois qu'un téléchargement d'image (demandé via
        on_request_image) se termine — path est None si le téléchargement a échoué."""
        self._update_queue.put(("imageready", code, path))

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

        elif kind == "scanimage":
            _, code, cached_path = item
            self._scan_image_code = code
            photo = self._load_photo(cached_path, (SCAN_IMG_PX - 8, SCAN_IMG_PX - 8)) if cached_path else None
            if photo:
                self._scan_image_label.config(image=photo, text="")
                self._scan_image_label.image = photo
            else:
                self._scan_image_label.config(image="", text=PLACEHOLDER_TEXT)
                self._scan_image_label.image = None

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
            self._scan_image_code = None
            self._scan_image_label.config(image="", text=PLACEHOLDER_TEXT)
            self._scan_image_label.image = None

        elif kind == "listdata":
            _, key, items = item
            st = self._lists[key]
            st["data"] = items or []
            st["updated_label"].config(text=f"Maj {datetime.now().strftime('%H:%M:%S')}")
            if key == "inventaire":
                self._inv_recompute()
            else:
                st["page"] = 0
                self._render_list(key)

        elif kind == "imageready":
            _, code, path = item
            self._apply_image_ready(code, path)

    def run(self):
        self.root.mainloop()
