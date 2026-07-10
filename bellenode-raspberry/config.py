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

DISPLAY_WIDTH   = getint("display", "width",  800)
DISPLAY_HEIGHT  = getint("display", "height", 480)
# Toujours plein écran sur le Pi — pas de sortie tactile, maintenance via SSH seulement.
FULLSCREEN      = True

COMMANDS = {CMD_MODE_PLUS, CMD_MODE_MINUS, CMD_MODE_SET, CMD_NEW_BATCH, CMD_SEND_NOW}

DATA_DIR = os.path.join(_BASE, "data")
LOGS_DIR = os.path.join(_BASE, "logs")
DB_PATH  = os.path.join(DATA_DIR, "queue.db")
