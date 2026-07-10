#!/usr/bin/env python3
"""Importe le catalogue SAQ crawlé dans la table Products de Bellenode.

- Produits deja presents (matches par CodeSaq) : mise a jour Volume/ImageUrl/Url/Prix uniquement.
  CodeUpc et Nom existants ne sont JAMAIS ecrases (deja verifies/scannes manuellement).
- Nouveaux produits (CodeSaq absent de Bellenode) : insertion complete si un CodeUpc est disponible.
- Prix stocke = prix SAQ (taxes incluses) / 1.14975, arrondi a 2 decimales (prix restaurant = SAQ hors taxes).
"""
import datetime
import json
import os

import pymssql

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSONL_PATH = os.path.join(BASE_DIR, "saq-data", "saq_products.jsonl")
TAX_DIVISOR = 1.14975

conn = pymssql.connect(
    server="sql5110.site4now.net",
    user="db_a13a40_bellenode_admin",
    password="Antho2026!",
    database="db_a13a40_bellenode",
    as_dict=True,
)
cur = conn.cursor()

cur.execute("SELECT Id, CodeSaq, CodeUpc FROM Products")
existing_rows = cur.fetchall()
existing_by_saq = {r["CodeSaq"]: r for r in existing_rows if r["CodeSaq"]}
existing_upcs = {r["CodeUpc"] for r in existing_rows if r["CodeUpc"]}

print(f"Produits existants dans Bellenode: {len(existing_rows)}")
print(f"  dont avec CodeSaq: {len(existing_by_saq)}")

updates = []
inserts = []
skipped_no_upc = 0
skipped_dup_upc = 0
seen_new_upcs = set()

with open(JSONL_PATH, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        saq = obj.get("codeSaq")
        if not saq:
            continue

        prix_raw = obj.get("prix")
        prix = round(prix_raw / TAX_DIVISOR, 2) if prix_raw is not None else None
        volume = obj.get("volume")
        image_url = obj.get("image")
        url = obj.get("url")

        existing = existing_by_saq.get(saq)
        if existing:
            updates.append((prix, volume, image_url, url, existing["Id"]))
        else:
            upc = obj.get("codeUpc")
            if not upc:
                skipped_no_upc += 1
                continue
            if upc in existing_upcs or upc in seen_new_upcs:
                skipped_dup_upc += 1
                continue
            seen_new_upcs.add(upc)
            nom = obj.get("nom") or upc
            inserts.append((upc, nom, saq, prix, volume, image_url, url))

print(f"\nA mettre a jour (produits existants, Volume/ImageUrl/Url/Prix seulement): {len(updates)}")
print(f"A inserer (nouveaux produits): {len(inserts)}")
print(f"Ignores (sans code UPC dans le crawl): {skipped_no_upc}")
print(f"Ignores (UPC en double avec un produit deja present): {skipped_dup_upc}")

confirm = os.environ.get("SAQ_IMPORT_CONFIRM") == "1"
if not confirm:
    print("\n[dry-run] Aucune ecriture effectuee. Relancer avec SAQ_IMPORT_CONFIRM=1 pour executer.")
    conn.close()
    raise SystemExit(0)

now = datetime.datetime.utcnow()

print("\nExecution des mises a jour...")
BATCH = 500
for i in range(0, len(updates), BATCH):
    chunk = updates[i:i + BATCH]
    cur.executemany(
        "UPDATE Products SET Prix = %s, Volume = %s, ImageUrl = %s, Url = %s, UpdatedAt = GETUTCDATE() WHERE Id = %s",
        chunk,
    )
    conn.commit()
    print(f"  ... {min(i + BATCH, len(updates))}/{len(updates)}")

print("\nExecution des insertions...")
for i in range(0, len(inserts), BATCH):
    chunk = inserts[i:i + BATCH]
    cur.executemany(
        """INSERT INTO Products (CodeUpc, Nom, CodeSaq, Prix, Volume, ImageUrl, Url, CreatedAt, UpdatedAt)
           VALUES (%s, %s, %s, %s, %s, %s, %s, GETUTCDATE(), GETUTCDATE())""",
        chunk,
    )
    conn.commit()
    print(f"  ... {min(i + BATCH, len(inserts))}/{len(inserts)}")

conn.close()
print("\nImport termine.")
