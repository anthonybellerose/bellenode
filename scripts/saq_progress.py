#!/usr/bin/env python3
"""Affiche la progression du crawl SAQ (lecture seule, ne touche pas au crawler).

Usage:
    python3 saq_progress.py            # affiche une fois
    python3 saq_progress.py --watch    # s'actualise en direct (Ctrl+C pour quitter)
"""
import argparse
import json
import os
import time

BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saq-data")
URLS_CACHE = os.path.join(BASE_DIR, "saq_urls.json")
OUTPUT_JSONL = os.path.join(BASE_DIR, "saq_products.jsonl")
ERRORS_LOG = os.path.join(BASE_DIR, "saq_errors.log")


def count_lines(path):
    if not os.path.exists(path):
        return 0
    with open(path, "rb") as f:
        return sum(1 for _ in f)


def render():
    if not os.path.exists(URLS_CACHE):
        print("Aucun crawl démarré (saq_urls.json introuvable).")
        return

    with open(URLS_CACHE, encoding="utf-8") as f:
        total = len(json.load(f))

    done = count_lines(OUTPUT_JSONL)
    errors = count_lines(ERRORS_LOG)
    processed = done + errors
    pct = (processed / total * 100) if total else 0

    bar_len = 40
    filled = int(bar_len * pct / 100)
    bar = "█" * filled + "░" * (bar_len - filled)

    start_time = os.path.getmtime(URLS_CACHE)
    elapsed = time.time() - start_time
    rate = processed / elapsed if elapsed > 0 else 0
    remaining = total - processed
    eta_sec = remaining / rate if rate > 0 else None

    lines = [
        f"[{bar}] {pct:5.1f}%",
        f"{processed}/{total} traités  ({done} OK, {errors} erreurs)",
    ]
    if rate > 0:
        h, rem = divmod(int(eta_sec), 3600)
        m, s = divmod(rem, 60)
        lines.append(f"Rythme: {rate*60:.1f} produits/min — ETA: ~{h}h{m:02d}m")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--watch", action="store_true", help="s'actualise en direct")
    parser.add_argument("--interval", type=float, default=3.0, help="secondes entre les rafraîchissements (--watch)")
    args = parser.parse_args()

    if not args.watch:
        out = render()
        if out:
            print(out)
        return

    try:
        while True:
            out = render()
            print("\033[2J\033[H", end="")  # clear écran + curseur en haut
            print(f"Crawl SAQ — {time.strftime('%H:%M:%S')}\n")
            if out:
                print(out)
            else:
                break
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()
