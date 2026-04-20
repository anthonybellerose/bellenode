#!/usr/bin/env python3
"""
Deploiement Bellenode vers SmarterASP via FTP.
Workflow:
1. Upload app_offline.htm a la racine pour arreter le pool IIS
2. Supprimer les fichiers web de la page de maintenance (index.html, default.htm si presents a la racine)
3. Upload recursif de publish/*
4. Supprimer app_offline.htm pour relancer le site
"""

from ftplib import FTP, error_perm
from pathlib import Path
import sys
import time

FTP_HOST = "win8073.site4now.net"
FTP_USER = "bellenode"
FTP_PASS = "Antho2026!"
PUBLISH_DIR = Path("/home/serveur02/bellenode/BellenodeApi/publish")
APP_OFFLINE = Path("/home/serveur02/bellenode/app_offline.htm")

SKIP_FILES = {"web.config.bak"}
DELETE_BEFORE_DEPLOY = ["default.htm", "index.html"]


def connect():
    print(f"Connexion FTP {FTP_HOST}...")
    ftp = FTP(FTP_HOST, timeout=60)
    ftp.login(FTP_USER, FTP_PASS)
    ftp.set_pasv(True)
    print(f"  Connecte. CWD: {ftp.pwd()}")
    return ftp


def ensure_dir(ftp: FTP, path: str):
    """Assure qu'un dossier distant existe en le creant par etapes."""
    if path in ("", "/", "."):
        return
    parts = path.replace("\\", "/").strip("/").split("/")
    current = ""
    for part in parts:
        if not part:
            continue
        current = current + "/" + part if current else part
        try:
            ftp.cwd("/" + current)
        except error_perm:
            try:
                ftp.mkd("/" + current)
            except error_perm as e:
                if "550" in str(e) and "exist" in str(e).lower():
                    pass
                else:
                    raise
    ftp.cwd("/")


def upload_file(ftp: FTP, local: Path, remote: str):
    with open(local, "rb") as f:
        ftp.storbinary(f"STOR /{remote}", f)


def upload_recursive(ftp: FTP, local_root: Path):
    files = [p for p in local_root.rglob("*") if p.is_file()]
    total = len(files)
    size_total = sum(p.stat().st_size for p in files)
    print(f"\nUpload de {total} fichiers ({size_total / 1024 / 1024:.1f} MB)...")

    created_dirs = set()
    uploaded = 0
    uploaded_bytes = 0
    t0 = time.time()

    for local in files:
        rel = local.relative_to(local_root).as_posix()
        if rel in SKIP_FILES:
            continue

        remote_dir = "/".join(rel.split("/")[:-1])
        if remote_dir and remote_dir not in created_dirs:
            ensure_dir(ftp, remote_dir)
            created_dirs.add(remote_dir)

        try:
            upload_file(ftp, local, rel)
            uploaded += 1
            uploaded_bytes += local.stat().st_size
            elapsed = time.time() - t0
            rate = uploaded_bytes / 1024 / elapsed if elapsed > 0 else 0
            pct = uploaded * 100 / total
            print(f"  [{uploaded:4d}/{total}] {pct:5.1f}% {rate:6.0f} KB/s  {rel}")
        except Exception as e:
            print(f"  ERREUR sur {rel}: {e}")
            raise

    print(f"\nTermine: {uploaded} fichiers uploade(s) en {time.time() - t0:.1f}s")


def try_delete(ftp: FTP, path: str) -> bool:
    try:
        ftp.delete(path)
        print(f"  delete {path}")
        return True
    except error_perm as e:
        msg = str(e)
        if "550" in msg and ("No such file" in msg or "not exist" in msg.lower() or "non-existant" in msg.lower()):
            return False
        print(f"  {path}: {e}")
        return False


def main():
    ftp = connect()

    try:
        print("\n=== ETAPE 1: Upload app_offline.htm (arret du site) ===")
        upload_file(ftp, APP_OFFLINE, "app_offline.htm")
        print("  OK, site en mode offline")

        print("\n=== ETAPE 2: Suppression anciens fichiers racine ===")
        for f in DELETE_BEFORE_DEPLOY:
            try_delete(ftp, f)

        print("\n=== ETAPE 3: Upload publish/ ===")
        upload_recursive(ftp, PUBLISH_DIR)

        print("\n=== ETAPE 4: Suppression app_offline.htm (redemarrage) ===")
        try_delete(ftp, "app_offline.htm")
        print("  Site en cours de redemarrage (IIS cold start 5-15s)")

        print("\n=== DEPLOY TERMINE ===")
        print("Test: https://bellenode.com")

    finally:
        try:
            ftp.quit()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main() or 0)
