import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BatchesApi } from '../api/client';
import type { ScanBatchDetail } from '../types';

export default function BatchDetail() {
  const { id } = useParams();
  const [batch, setBatch] = useState<ScanBatchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    BatchesApi.get(parseInt(id))
      .then(setBatch)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-gray-400">Chargement...</div>;
  if (!batch) return <div className="text-gray-500">Batch introuvable.</div>;

  return (
    <div className="space-y-6">
      <header>
        <Link to="/batches" className="text-sm text-accent hover:text-accent-hover">
          ← Retour à l'historique
        </Link>
        <h2 className="text-3xl font-bold text-white mt-2">Batch #{batch.id}</h2>
        <p className="text-gray-400 mt-1">
          {new Date(batch.createdAt).toLocaleString('fr-CA')}
          {batch.createdBy && <> · par {batch.createdBy}</>}
          {batch.note && <> · {batch.note}</>}
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Lignes" value={batch.lignesOps} />
        <Stat label="Produits" value={batch.produitsTouches} />
        <Stat label="Ajouts" value={batch.totalAjouts} tone="green" />
        <Stat label="Retraits" value={batch.totalRetraits} tone="red" />
      </div>

      <section className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-bg-border">
          <h3 className="font-semibold">Opérations ({batch.operations.length})</h3>
        </div>
        <table className="table-default">
          <thead>
            <tr>
              <th className="w-14">Mode</th>
              <th>Code</th>
              <th>Produit</th>
              <th className="text-right">Qté</th>
              <th className="text-right">Avant</th>
              <th className="text-right">Après</th>
            </tr>
          </thead>
          <tbody>
            {batch.operations.map((op) => (
              <tr key={op.id}>
                <td>
                  <span
                    className={`badge ${
                      op.mode === 'Add' ? 'badge-green' : op.mode === 'Remove' ? 'badge-red' : 'badge-blue'
                    }`}
                  >
                    {op.mode === 'Add' ? '+' : op.mode === 'Remove' ? '−' : '='}
                  </span>
                </td>
                <td className="font-mono text-xs text-gray-400">{op.code}</td>
                <td>
                  {op.isReferenced ? (
                    op.nom ?? '—'
                  ) : (
                    <span className="badge badge-yellow">Non référencé</span>
                  )}
                </td>
                <td className="text-right">{op.quantite}</td>
                <td className="text-right text-gray-500">{op.qtyAvant}</td>
                <td className="text-right font-semibold">{op.qtyApres}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-400' : tone === 'red' ? 'text-red-400' : 'text-white';
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500 uppercase">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
