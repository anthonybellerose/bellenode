"""
Lecture du scanner HID via evdev (mode Raspberry Pi réel)
ou via stdin (mode simulation pour tests sur PC/serveur).
"""
import logging
import queue
import sys
import threading

logger = logging.getLogger(__name__)

# Mapping evdev keycode → caractère
_KEYMAP = {
    "KEY_0": "0", "KEY_1": "1", "KEY_2": "2", "KEY_3": "3", "KEY_4": "4",
    "KEY_5": "5", "KEY_6": "6", "KEY_7": "7", "KEY_8": "8", "KEY_9": "9",
    "KEY_A": "A", "KEY_B": "B", "KEY_C": "C", "KEY_D": "D", "KEY_E": "E",
    "KEY_F": "F", "KEY_G": "G", "KEY_H": "H", "KEY_I": "I", "KEY_J": "J",
    "KEY_K": "K", "KEY_L": "L", "KEY_M": "M", "KEY_N": "N", "KEY_O": "O",
    "KEY_P": "P", "KEY_Q": "Q", "KEY_R": "R", "KEY_S": "S", "KEY_T": "T",
    "KEY_U": "U", "KEY_V": "V", "KEY_W": "W", "KEY_X": "X", "KEY_Y": "Y",
    "KEY_Z": "Z", "KEY_MINUS": "-", "KEY_UNDERSCORE": "_",
}

def _find_scanner_device():
    """Retourne le premier device evdev qui ressemble à un scanner HID."""
    try:
        import evdev
        devices = [evdev.InputDevice(p) for p in evdev.list_devices()]
        for d in devices:
            caps = d.capabilities(verbose=True)
            keys = caps.get(("EV_KEY", 1), [])
            key_names = [k[0] for pair in keys for k in (pair if isinstance(pair, list) else [pair])]
            # Un scanner HID a des touches numériques et KEY_ENTER
            if "KEY_ENTER" in key_names and "KEY_1" in key_names:
                logger.info(f"Scanner détecté : {d.name} ({d.path})")
                return d
        logger.warning("Aucun scanner HID détecté — utilise le premier clavier trouvé")
        return evdev.InputDevice(evdev.list_devices()[0]) if evdev.list_devices() else None
    except Exception as e:
        logger.error(f"Erreur détection scanner : {e}")
        return None


class ScannerReader(threading.Thread):
    """
    Thread qui lit les scans et les pousse dans `out_queue`.
    Chaque item dans la queue est une string (code-barres complet).
    """
    daemon = True

    def __init__(self, out_queue: queue.Queue, simulate: bool = False):
        super().__init__(name="ScannerReader")
        self.out_queue = out_queue
        self.simulate = simulate

    def run(self):
        if self.simulate:
            self._run_simulate()
        else:
            self._run_evdev()

    # ── Mode simulation (stdin) ───────────────────────────────────────────────

    def _run_simulate(self):
        logger.info("Scanner en mode SIMULATION — tape un code-barres + Entrée")
        try:
            for line in sys.stdin:
                code = line.strip()
                if code:
                    logger.debug(f"[SIM] Scan : {code}")
                    self.out_queue.put(code)
        except (EOFError, KeyboardInterrupt):
            pass

    # ── Mode réel (evdev) ─────────────────────────────────────────────────────

    def _run_evdev(self):
        try:
            import evdev
        except ImportError:
            logger.error("evdev non installé — basculement en mode simulation")
            self._run_simulate()
            return

        device = _find_scanner_device()
        if device is None:
            logger.error("Aucun device scanner trouvé — basculement en simulation")
            self._run_simulate()
            return

        logger.info(f"Lecture scanner sur {device.path}")
        buffer = []
        try:
            for event in device.read_loop():
                if event.type != evdev.ecodes.EV_KEY:
                    continue
                key_event = evdev.categorize(event)
                if key_event.keystate != evdev.KeyEvent.key_down:
                    continue

                key = key_event.keycode
                if isinstance(key, list):
                    key = key[0]

                if key == "KEY_ENTER":
                    if buffer:
                        code = "".join(buffer)
                        logger.debug(f"Scan reçu : {code}")
                        self.out_queue.put(code)
                        buffer.clear()
                elif key in _KEYMAP:
                    buffer.append(_KEYMAP[key])
        except Exception as e:
            logger.error(f"Erreur lecture scanner : {e}")
