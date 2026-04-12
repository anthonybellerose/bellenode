import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { InventoryApi } from '../api/client';
import type { InventorySummary, InventoryRow } from '../types';

export default function Dashboard() {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [recent, setRecent] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, inv] = await Promise.all([InventoryApi.summary(), InventoryApi.list()]);
        setSummary(s);
        setRecent(
          [...inv]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 10),
        );
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Dashboard</h2>
          <p className="text-gray-400 mt-1">Vue d'ensemble de l'inventaire</p>
        </div>
        <Link to="/scan" className="btn btn-primary">
          + Nouveau scan
        </Link>
      </header>

      {loading ? (
        <div className="text-gray-400">Chargement...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Produits référencés" value={summary?.totalReferenced ?? 0} sub={`${summary?.distinctReferenced ?? 0} codes`} />
            <StatCard label="Non référencés" value={summary?.totalNonReferenced ?? 0} sub={`${summary?.distinctNonReferenced ?? 0} codes`} tone="yellow" />
            <StatCard label="Catalogue" value={summary?.totalProducts ?? 0} sub="produits" />
            <StatCard label="Batches" value={summary?.totalBatches ?? 0} sub="historique" />
          </div>

          <section className="card">
            <div className="px-5 py-3 border-b border-bg-border flex items-center justify-between">
              <h3 className="font-semibold">Derniers produits modifiés</h3>
              <Link to="/produits" className="text-sm text-accent hover:text-accent-hover">
                Voir tout →
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Aucun produit en inventaire. Fais ton premier scan !
              </div>
            ) : (
              <table className="table-default">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Nom</th>
                    <th className="text-right">Quantité</th>
                    <th>Dernière maj</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-xs text-gray-400">{row.code}</td>
                      <td>
                        {row.nom ?? <span className="badge badge-yellow">Non référencé</span>}
                      </td>
                      <td className="text-right font-semibold">{row.quantite}</td>
                      <td className="text-gray-500 text-xs">
                        {new Date(row.updatedAt).toLocaleString('fr-CA')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = 'blue',
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: 'blue' | 'yellow';
}) {
  const valueColor = tone === 'yellow' ? 'text-yellow-400' : 'text-white';
  return (
    <div className="card p-5">
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${valueColor}`}>{value.toLocaleString('fr-CA')}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
