#!/usr/bin/env python3
"""Crawler catalogue SAQ.com : code SAQ, code UPC, nom, prix, volume, image.

Usage:
    python3 saq_crawler.py              # lance/continue le crawl complet
    python3 saq_crawler.py --limit 5    # test rapide sur 5 produits
    python3 saq_crawler.py --check      # compare le sitemap actuel au dernier snapshot, rapporte les changements (aucun crawl)
    python3 saq_crawler.py --update     # comme --check, mais crawl automatiquement les nouveaux/modifiés
    python3 saq_crawler.py --to-csv     # convertit saq_products.jsonl en CSV
"""
import argparse
import csv
import json
import os
import random
import re
import time
import xml.etree.ElementTree as ET

import requests

BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saq-data")
os.makedirs(BASE_DIR, exist_ok=True)

SITEMAP_INDEX = "https://www.saq.com/media/sitemaps/fr/sitemap_product.xml"
URLS_CACHE = os.path.join(BASE_DIR, "saq_urls.json")
OUTPUT_JSONL = os.path.join(BASE_DIR, "saq_products.jsonl")
OUTPUT_CSV = os.path.join(BASE_DIR, "saq_products.csv")
ERRORS_LOG = os.path.join(BASE_DIR, "saq_errors.log")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept-Language": "fr-CA,fr;q=0.9",
}

MIN_DELAY = 0.8
MAX_DELAY = 1.5
MAX_RETRIES = 3

NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

FIELDS = ["codeSaq", "codeUpc", "nom", "prix", "volume", "image",
          "categorie", "origine", "disponible", "url"]


def fetch_sitemap():
    """Retourne un dict {url: lastmod} en tirant toujours les données fraîches du sitemap SAQ."""
    print("[sitemap] téléchargement de l'index...")
    idx = requests.get(SITEMAP_INDEX, headers=HEADERS, timeout=30)
    idx.raise_for_status()
    root = ET.fromstring(idx.content)
    sub_sitemaps = [el.text for el in root.findall(".//sm:loc", NS)]

    url_map = {}
    for sm_url in sub_sitemaps:
        print(f"[sitemap] téléchargement {sm_url} ...")
        r = requests.get(sm_url, headers=HEADERS, timeout=30)
        r.raise_for_status()
        sroot = ET.fromstring(r.content)
        for url_el in sroot.findall(".//sm:url", NS):
            loc_el = url_el.find("sm:loc", NS)
            if loc_el is None:
                continue
            lastmod_el = url_el.find("sm:lastmod", NS)
            url_map[loc_el.text] = lastmod_el.text if lastmod_el is not None else None
        time.sleep(0.5)

    print(f"[sitemap] {len(url_map)} URLs trouvées")
    return url_map


def load_snapshot():
    """Dernier état connu du sitemap {url: lastmod}. Gère l'ancien format (liste plate)."""
    if not os.path.exists(URLS_CACHE):
        return {}
    with open(URLS_CACHE, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return {u: None for u in data}
    return data


def save_snapshot(url_map):
    with open(URLS_CACHE, "w", encoding="utf-8") as f:
        json.dump(url_map, f)


def load_done_codes():
    done = set()
    if os.path.exists(OUTPUT_JSONL):
        with open(OUTPUT_JSONL, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    done.add(obj["codeSaq"])
                except Exception:
                    continue
    return done


def extract_product(html, url):
    blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
    best = None
    for b in blocks:
        try:
            obj = json.loads(b.strip())
        except Exception:
            continue
        if obj.get("@type") != "Product":
            continue
        if "gtin12" in obj:
            best = obj
            break
        if best is None:
            best = obj

    if best is None:
        return None

    offers = best.get("offers", {}) or {}
    price = offers.get("price")
    try:
        price = float(price) if price is not None else None
    except (TypeError, ValueError):
        price = None

    availability = offers.get("availability") or ""

    return {
        "codeSaq": best.get("sku"),
        "codeUpc": best.get("gtin12"),
        "nom": best.get("name"),
        "prix": price,
        "volume": best.get("size"),
        "image": best.get("image"),
        "categorie": best.get("category"),
        "origine": best.get("countryOfOrigin"),
        "disponible": availability.endswith("InStock") if availability else None,
        "url": url,
    }


def crawl(limit=None, url_list=None, force=False):
    if url_list is None:
        url_map = fetch_sitemap()
        save_snapshot(url_map)
        url_list = sorted(url_map.keys())

    urls = url_list
    done = set() if force else load_done_codes()
    if limit:
        urls = urls[:limit]
    print(f"[crawl] {len(done)} produits déjà récupérés, {len(urls)} URLs à traiter dans ce lot")

    session = requests.Session()
    session.headers.update(HEADERS)

    processed = 0
    errors = 0
    skipped = 0

    with open(OUTPUT_JSONL, "a", encoding="utf-8") as out, \
         open(ERRORS_LOG, "a", encoding="utf-8") as errlog:
        for url in urls:
            code = url.rstrip("/").rsplit("/", 1)[-1]
            if code in done:
                skipped += 1
                continue

            product = None
            resp = None
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    resp = session.get(url, timeout=20)
                    if resp.status_code == 200:
                        product = extract_product(resp.text, url)
                        break
                    if resp.status_code == 404:
                        break
                    time.sleep(2 * attempt)
                except requests.RequestException:
                    time.sleep(2 * attempt)

            if product and product.get("codeSaq"):
                out.write(json.dumps(product, ensure_ascii=False) + "\n")
                out.flush()
                processed += 1
            else:
                status = resp.status_code if resp is not None else "timeout"
                errlog.write(f"{code}\t{url}\t{status}\n")
                errlog.flush()
                errors += 1

            total = processed + errors
            if total % 50 == 0:
                print(f"[crawl] {total}/{len(urls)} traités ({processed} OK, {errors} erreurs, {skipped} déjà faits)")

            time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

    print(f"[crawl] terminé. {processed} produits ajoutés, {errors} erreurs, {skipped} déjà faits.")
    print(f"[crawl] données: {OUTPUT_JSONL}")


def to_csv():
    if not os.path.exists(OUTPUT_JSONL):
        print(f"Aucun fichier {OUTPUT_JSONL} trouvé.")
        return
    count = 0
    with open(OUTPUT_JSONL, encoding="utf-8") as f, \
         open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as out:
        writer = csv.DictWriter(out, fieldnames=FIELDS)
        writer.writeheader()
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            writer.writerow({k: obj.get(k) for k in FIELDS})
            count += 1
    print(f"[csv] {count} lignes écrites dans {OUTPUT_CSV}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="limiter à N produits (test)")
    parser.add_argument("--to-csv", action="store_true", help="convertir le jsonl existant en CSV")
    args = parser.parse_args()

    if args.to_csv:
        to_csv()
    else:
        try:
            crawl(limit=args.limit)
        except KeyboardInterrupt:
            print("\n[crawl] interrompu — relance le script plus tard, il reprendra où il s'est arrêté.")
