"""
Cache local des photos de produits sur le Raspberry Pi.

But : ne jamais bloquer l'interface tkinter sur un téléchargement réseau. Ce
module fait deux choses bien séparées :
  - fetch_and_cache() : téléchargement + redimensionnement, à appeler UNIQUEMENT
    depuis un thread de fond (jamais depuis le thread principal tkinter).
  - get_cached_path() : lecture disque instantanée, sûre à appeler partout.

Une fois qu'une image est en cache, elle ne retourne jamais sur le réseau —
le Pi fonctionne donc hors ligne pour tout ce qui a déjà été vu une fois.
"""
import hashlib
import logging
import os
from io import BytesIO

import requests
from PIL import Image

import config

logger = logging.getLogger(__name__)

CACHE_DIR = os.path.join(config.DATA_DIR, "images")
CACHE_SIZE = (200, 200)  # taille unique mise en cache ; les écrans redimensionnent à la volée depuis ce fichier

os.makedirs(CACHE_DIR, exist_ok=True)


def _cache_path(code: str) -> str:
    # Nom de fichier sûr même si le code contient des caractères spéciaux
    safe = hashlib.md5(code.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f"{safe}.jpg")


def get_cached_path(code: str) -> str | None:
    """Lecture disque seule, instantanée — sûre à appeler depuis le thread tkinter."""
    path = _cache_path(code)
    return path if os.path.exists(path) else None


def fetch_and_cache(code: str, url: str | None) -> str | None:
    """Télécharge et redimensionne une image produit. NE JAMAIS appeler depuis le
    thread principal tkinter — fait du réseau. Retourne le chemin local ou None."""
    path = _cache_path(code)
    if os.path.exists(path):
        return path
    if not url:
        return None
    try:
        r = requests.get(url, timeout=8)
        r.raise_for_status()
        img = Image.open(BytesIO(r.content)).convert("RGB")
        img.thumbnail(CACHE_SIZE)
        # Écriture atomique : jamais de fichier tronqué visible par un lecteur concurrent
        tmp_path = path + ".tmp"
        img.save(tmp_path, "JPEG", quality=85)
        os.replace(tmp_path, path)
        return path
    except Exception as e:
        logger.warning(f"Erreur téléchargement image {code} : {e}")
        return None
