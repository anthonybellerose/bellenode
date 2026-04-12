import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BatchesApi } from '../api/client';
import type { ScanBatch } from '../types';

export default function Batches() {
  const [batches, setBatches] = useState<ScanBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    BatchesApi.list()
      .then(setBatches)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="hidden md:block">
        <h2 className="page-title">Historique des batches</h2>
        <p className="page-subtitle">Tous les scans enregistrés — {batches.length} batch(es)</p>
      </header>

      <section className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Aucun batch enregistré.</div>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="md:hidden divide-y divide-bg-border">
              {batches.map((b) => (
                <li key={b.id}>
                  <Link to={`/batches/${b.id}`} className="block p-3 active:bg-bg-elevated">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-accent">#{b.id}</span>
                          {b.createdBy && <span className="text-xs text-gray-400">· {b.createdBy}</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(b.createdAt).toLocaleString('fr-CA')}
                        </div>
                        {b.note && <div className="text-xs text-gray-400 mt-1 truncate">{b.note}</div>}
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-gray-300">{b.produitsTouches} produits</div>
                        <div>
                          <span className="text-green-400">+{b.totalAjouts}</span>
                          <span className="text-gray-600 mx-1">/</span>
                          <span className="text-red-400">−{b.totalRetraits}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {/* Desktop: table */}
            <div className="hidden md:block table-wrap">
              <table className="table-default">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Par</th>
                    <th>Note</th>
                    <th className="text-right">Lignes</th>
                    <th className="text-right">Produits</th>
                    <th className="text-right">+ / −</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td className="font-mono text-gray-400">#{b.id}</td>
                      <td className="text-gray-300">{new Date(b.createdAt).toLocaleString('fr-CA')}</td>
                      <td className="text-gray-400">{b.createdBy ?? '—'}</td>
                      <td className="text-gray-400">{b.note ?? '—'}</td>
                      <td className="text-right">{b.lignesOps}</td>
                      <td className="text-right">{b.produitsTouches}</td>
                      <td className="text-right">
                        <span className="text-green-400">+{b.totalAjouts}</span>
                        <span className="text-gray-600 mx-1">/</span>
                        <span className="text-red-400">−{b.totalRetraits}</span>
                      </td>
                      <td>
                        <Link to={`/batches/${b.id}`} className="text-accent hover:text-accent-hover text-sm">
                          Détails →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
