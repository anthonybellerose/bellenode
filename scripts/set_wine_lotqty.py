#!/usr/bin/env python3
"""Met LotQty=12 sur les vins format bouteille reguliere (750ml, 1L).

Categorie SAQ commencant par "Vin " (exclut Champagne, coolers/cocktails au vin,
cellier/box qui se trouvent dans les gros formats 3L+, et les mini bouteilles).
La categorie n'est pas stockee dans Bellenode -> on la lit depuis le fichier de crawl,
puis on met a jour Products par CodeSaq.
"""
import json
import os

import pymssql

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSONL_PATH = os.path.join(BASE_DIR, "saq-data", "saq_products.jsonl")
TARGET_VOLUMES = {"750ml", "1L"}

conn = pymssql.connect(
    server="sql5110.site4now.net",
    user="db_a13a40_bellenode_admin",
    password="Antho2026!",
    database="db_a13a40_bellenode",
    as_dict=True,
)
cur = conn.cursor()

qualifying_saq = []
with open(JSONL_PATH, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        cat = obj.get("categorie") or ""
        vol = obj.get("volume") or ""
        if cat.startswith("Vin ") and vol in TARGET_VOLUMES:
            qualifying_saq.append(obj["codeSaq"])

print(f"Codes SAQ qualifiants (vin, 750ml/1L): {len(qualifying_saq)}")

cur.execute("SELECT CodeSaq FROM Products WHERE CodeSaq IS NOT NULL")
existing_saq = {r["CodeSaq"] for r in cur.fetchall()}
to_update = [s for s in qualifying_saq if s in existing_saq]
print(f"Presents dans Bellenode et a mettre a jour: {len(to_update)}")

cur.execute("SELECT COUNT(*) as n FROM Products WHERE LotQty = 12")
print(f"Deja a lot=12 avant update: {cur.fetchone()['n']}")

confirm = os.environ.get("WINE_LOT_CONFIRM") == "1"
if not confirm:
    print("\n[dry-run] Aucune ecriture. Relancer avec WINE_LOT_CONFIRM=1 pour executer.")
    conn.close()
    raise SystemExit(0)

BATCH = 500
params = [(s,) for s in to_update]
for i in range(0, len(params), BATCH):
    chunk = params[i:i + BATCH]
    placeholders = ",".join(["%s"] * len(chunk))
    cur.executemany(
        "UPDATE Products SET LotQty = 12, UpdatedAt = GETUTCDATE() WHERE CodeSaq = %s",
        chunk,
    )
    conn.commit()
    print(f"  ... {min(i + BATCH, len(params))}/{len(params)}")

cur.execute("SELECT COUNT(*) as n FROM Products WHERE LotQty = 12")
print(f"\nA lot=12 apres update: {cur.fetchone()['n']}")
conn.close()
