#!/usr/bin/env python3
"""Backup complet de la base Bellenode (toutes les tables) vers des fichiers JSON.

Usage: python3 backup_db.py
"""
import datetime
import decimal
import json
import os

import pymssql

BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db-backups")


def json_default(obj):
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    if isinstance(obj, bytes):
        return obj.hex()
    raise TypeError(f"Type non sérialisable: {type(obj)}")


def main():
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = os.path.join(BASE_DIR, stamp)
    os.makedirs(out_dir, exist_ok=True)

    conn = pymssql.connect(
        server="sql5110.site4now.net",
        user="db_a13a40_bellenode_admin",
        password="Antho2026!",
        database="db_a13a40_bellenode",
        as_dict=True,
    )
    cur = conn.cursor()
    cur.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")
    tables = [row["TABLE_NAME"] for row in cur.fetchall()]

    summary = {}
    for table in tables:
        cur.execute(f"SELECT * FROM [{table}]")
        rows = cur.fetchall()
        path = os.path.join(out_dir, f"{table}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(rows, f, default=json_default, ensure_ascii=False)
        summary[table] = len(rows)
        print(f"[backup] {table}: {len(rows)} lignes")

    conn.close()

    with open(os.path.join(out_dir, "_summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"\n[backup] terminé -> {out_dir}")


if __name__ == "__main__":
    main()
