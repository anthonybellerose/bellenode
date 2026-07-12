#!/usr/bin/env python3
"""
Précharge en une fois les photos de tous les produits du catalogue dans le cache
local (data/images/), pour que le premier scan de chaque produit soit déjà
instantané au lieu d'attendre un téléchargement en direct.

Usage : python3 preload_images.py
"""
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

import config
import image_cache

CONCURRENCY = 8


def main():
    session = requests.Session()
    r = session.post(
        f"{config.API_URL}/api/auth/login",
        json={"email": config.API_EMAIL, "password": config.API_PASSWORD},
        timeout=10,
    )
    r.raise_for_status()
    token = r.json()["token"]
    session.headers.update({
        "Authorization": f"Bearer {token}",
        "X-Restaurant-Id": str(config.RESTAURANT_ID),
    })

    print("Récupération du catalogue...")
    r = session.get(f"{config.API_URL}/api/products/cache-pi", timeout=60)
    r.raise_for_status()
    products = r.json()
    print(f"{len(products)} produits reçus.")

    todo = [(p["codeUpc"], p.get("imageUrl")) for p in products if p.get("codeUpc") and p.get("imageUrl")]
    already = sum(1 for code, _ in todo if image_cache.get_cached_path(code))
    print(f"{already} déjà en cache, {len(todo) - already} à télécharger (concurrence={CONCURRENCY}).")

    failed = 0
    start = time.time()

    def work(item):
        code, url = item
        if image_cache.get_cached_path(code):
            return "skip"
        return "ok" if image_cache.fetch_and_cache(code, url) else "fail"

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = [pool.submit(work, item) for item in todo]
        for i, future in enumerate(as_completed(futures), 1):
            if future.result() == "fail":
                failed += 1
            if i % 500 == 0 or i == len(todo):
                print(f"  {i}/{len(todo)} traités ({failed} échecs) — {time.time()-start:.0f}s")

    print(f"\nTerminé en {time.time()-start:.0f}s — {failed} échec(s) sur {len(todo)}.")


if __name__ == "__main__":
    main()
