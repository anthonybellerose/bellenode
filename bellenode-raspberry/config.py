import configparser
import os

_BASE = os.path.dirname(os.path.abspath(__file__))
_CONFIG_PATH = os.path.join(_BASE, "config", "config.ini")

_cfg = configparser.ConfigParser()
_cfg.read(_CONFIG_PATH)

def get(section: str, key: str, fallback=None):
    return _cfg.get(section, key, fallback=fallback)

def getint(section: str, key: str, fallback: int = 0) -> int:
    return _cfg.getint(section, key, fallback=fallback)

def getbool(section: str, key: str, fallback: bool = False) -> bool:
    return _cfg.getboolean(section, key, fallback=fallback)

API_URL         = get("api", "url", "https://bellenode.com")
API_EMAIL       = get("api", "email")
API_PASSWORD    = get("api", "password")
RESTAURANT_ID   = getint("api", "restaurant_id", 1)

DEFAULT_MODE    = get("scanner", "default_mode", "minus")
CMD_MODE_PLUS   = get("scanner", "barcode_mode_plus",  "CMD_MODE_PLUS")
CMD_MODE_MINUS  = get("scanner", "barcode_mode_minus", "CMD_MODE_MINUS")
CMD_MODE_SET    = get("scanner", "barcode_mode_set",   "CMD_MODE_SET")
CMD_NEW_BATCH   = get("scanner", "barcode_new_batch",  "CMD_NEW_BATCH")
CMD_SEND_NOW    = get("scanner", "barcode_send_now",   "CMD_SEND_NOW")

RETRY_INTERVAL  = getint("queue", "retry_interval_seconds", 30)
RECONCILE_HOUR  = getint("queue", "reconcile_hour", 2)
STATUS_CHECK_INTERVAL   = getint("queue", "status_check_interval_seconds", 10)
LOWSTOCK_CHECK_INTERVAL = getint("queue", "lowstock_check_interval_seconds", 60)
# Stock (léger : juste les quantités du restaurant) — rafraîchi souvent pour rester
# synchronisé avec les commandes reçues / ajustements faits sur le web ou le téléphone.
STOCK_REFRESH_INTERVAL   = getint("queue", "stock_refresh_interval_seconds", 120)
# Catalogue complet (25k+ produits, plus lourd) — rafraîchi moins souvent, mais surtout
# sert de filet de sécurité si le téléchargement du démarrage a échoué (réseau pas encore
# prêt au boot) : avant, il fallait attendre la réconciliation de 2h du matin.
CATALOG_REFRESH_INTERVAL = getint("queue", "catalog_refresh_interval_seconds", 1800)
# Envoi de la température/throttling au serveur — voir main.py::_health_report_loop.
# Conservé en base pour survivre aux redémarrages fréquents du Pi (le compteur throttled
# du Pi lui-même se réinitialise à chaque boot, impossible de savoir après coup s'il y a
# eu de la surchauffe, voir été 2026).
HEALTH_REPORT_INTERVAL = getint("queue", "health_report_interval_seconds", 900)

DISPLAY_WIDTH   = getint("display", "width",  1280)
DISPLAY_HEIGHT  = getint("display", "height", 720)
# Toujours plein écran sur le Pi. Sortie tactile cachée : appui long (3,5s) dans
# le coin haut-gauche + code PIN — voir KIOSK_EXIT_PIN. Change ce PIN dans
# config.ini, ne jamais laisser la valeur par défaut sur un appareil en service.
FULLSCREEN      = True
KIOSK_EXIT_PIN  = get("kiosk", "exit_pin", "1234")

COMMANDS = {CMD_MODE_PLUS, CMD_MODE_MINUS, CMD_MODE_SET, CMD_NEW_BATCH, CMD_SEND_NOW}

DATA_DIR = os.path.join(_BASE, "data")
LOGS_DIR = os.path.join(_BASE, "logs")
DB_PATH  = os.path.join(DATA_DIR, "queue.db")
