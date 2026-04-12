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
    <div className="space-y-4 md:space-y-6">
      <header>
        <Link to="/batches" className="text-sm text-accent active:text-accent-hover">
          ← Retour
        </Link>
        <h2 className="page-title mt-1 md:mt-2">Batch #{batch.id}</h2>
        <p className="page-subtitle">
          {new Date(batch.createdAt).toLocaleString('fr-CA')}
          {batch.createdBy && <> · {batch.createdBy}</>}
          {batch.note && <> · {batch.note}</>}
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Lignes" value={batch.lignesOps} />
        <Stat label="Produits" value={batch.produitsTouches} />
        <Stat label="Ajouts" value={batch.totalAjouts} tone="green" />
        <Stat label="Retraits" value={batch.totalRetraits} tone="red" />
      </div>

      <section className="card overflow-hidden">
        <div className="px-4 md:px-5 py-3 border-b border-bg-border">
          <h3 className="font-semibold text-sm md:text-base">
            Opérations ({batch.operations.length})
          </h3>
        </div>
        {/* Mobile: liste */}
        <ul className="md:hidden divide-y divide-bg-border">
          {batch.operations.map((op) => (
            <li key={op.id} className="p-3 flex items-start gap-3">
              <span
                className={`badge text-base px-2 py-1 ${
                  op.mode === 'Add' ? 'badge-green' : op.mode === 'Remove' ? 'badge-red' : 'badge-blue'
                }`}
              >
                {op.mode === 'Add' ? '+' : op.mode === 'Remove' ? '−' : '='}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-100 truncate">
                  {op.isReferenced ? op.nom ?? '—' : <span className="badge badge-yellow">Non référencé</span>}
                </div>
                <div className="font-mono text-[10px] text-gray-500 truncate">{op.code}</div>
              </div>
              <div className="text-right text-xs flex-shrink-0">
                <div className="text-base font-bold">
                  {op.qtyAvant} → <span className="text-accent">{op.qtyApres}</span>
                </div>
                <div className="text-gray-500">qté {op.quantite}</div>
              </div>
            </li>
          ))}
        </ul>
        {/* Desktop: table */}
        <div className="hidden md:block">
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
        </div>
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
