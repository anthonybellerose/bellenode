"""
Queue locale SQLite.
Chaque scan est sauvegardé avant d'être envoyé à l'API.
Statuts : pending → sent | failed
"""
import logging
import os
import sqlite3
import threading
import time
from dataclasses import dataclass

import config

logger = logging.getLogger(__name__)

@dataclass
class QueuedScan:
    id: int
    barcode: str
    mode: str
    batch_id: int
    scanned_at: float
    status: str
    attempts: int


class LocalQueue:
    def __init__(self):
        os.makedirs(config.DATA_DIR, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(config.DB_PATH, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_db()

    def _init_db(self):
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                barcode     TEXT    NOT NULL,
                mode        TEXT    NOT NULL,
                batch_id    INTEGER NOT NULL,
                scanned_at  REAL    NOT NULL,
                status      TEXT    NOT NULL DEFAULT 'pending',
                attempts    INTEGER NOT NULL DEFAULT 0
            )
        """)
        self._conn.commit()

    def push(self, barcode: str, mode: str, batch_id: int) -> int:
        with self._lock:
            cur = self._conn.execute(
                "INSERT INTO scans (barcode, mode, batch_id, scanned_at) VALUES (?,?,?,?)",
                (barcode, mode, batch_id, time.time()),
            )
            self._conn.commit()
            return cur.lastrowid

    def mark_sent(self, scan_id: int):
        with self._lock:
            self._conn.execute(
                "UPDATE scans SET status='sent' WHERE id=?", (scan_id,)
            )
            self._conn.commit()

    def mark_failed(self, scan_id: int):
        with self._lock:
            self._conn.execute(
                "UPDATE scans SET status='failed', attempts=attempts+1 WHERE id=?",
                (scan_id,),
            )
            self._conn.commit()

    def increment_attempt(self, scan_id: int):
        with self._lock:
            self._conn.execute(
                "UPDATE scans SET attempts=attempts+1 WHERE id=?", (scan_id,)
            )
            self._conn.commit()

    def get_pending(self) -> list[QueuedScan]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM scans WHERE status='pending' ORDER BY id"
            ).fetchall()
        return [QueuedScan(**dict(r)) for r in rows]

    def pending_count(self) -> int:
        with self._lock:
            return self._conn.execute(
                "SELECT COUNT(*) FROM scans WHERE status='pending'"
            ).fetchone()[0]

    def pending_count_for(self, barcode: str, mode: str) -> int:
        """Nombre de scans en attente pour un code+mode précis — utilisé par le mode SET
        pour afficher le compte réel en cours (voir main.py::_handle_barcode)."""
        with self._lock:
            return self._conn.execute(
                "SELECT COUNT(*) FROM scans WHERE status='pending' AND barcode=? AND mode=?",
                (barcode, mode),
            ).fetchone()[0]

    def today_sent_count(self) -> int:
        start_of_day = time.mktime(time.localtime()[:3] + (0, 0, 0, 0, 0, -1))
        with self._lock:
            return self._conn.execute(
                "SELECT COUNT(*) FROM scans WHERE status='sent' AND scanned_at >= ?",
                (start_of_day,),
            ).fetchone()[0]
