import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { StatsApi, type StatsData, type DepensesData } from '../api/client';

const COLORS = {
  ok: '#10b981',
  bas: '#f59e0b',
  rupture: '#ef4444',
  ignore: '#6b7280',
  accent: '#3b82f6',
};

export default function Stats() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [jours, setJours] = useState(30);
  const [depenses, setDepenses] = useState<DepensesData | null>(null);

  useEffect(() => {
    setLoading(true);
    StatsApi.get(jours).then(setData).finally(() => setLoading(false));
  }, [jours]);

  useEffect(() => {
    StatsApi.getDepenses().then(setDepenses);
  }, []);

  if (loading && !data) return <div className="p-8 text-center text-gray-400">Chargement...</div>;
  if (!data) return null;

  const statutData = [
    { name: 'OK',          value: data.statut.ok,      color: COLORS.ok },
    { name: 'Stock bas',   value: data.statut.bas,     color: COLORS.bas },
    { name: 'Rupture',     value: data.statut.rupture, color: COLORS.rupture },
    { name: 'Sans objectif', value: data.statut.ignore, color: COLORS.ignore },
  ].filter(d => d.value > 0);

  const parJour = data.parJour.map(d => ({
    date: d.date.slice(5),
    total: d.total
  }));

  const topData = data.topConsommes.map(t => ({
    nom: t.nom.replace(/\s*-\s*\d.*$/, '').slice(0, 32),
    total: t.total,
  }));

  const fmt$ = (n: number) => n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="page-title">Statistiques</h2>
          <p className="page-subtitle">Période de {data.periode} jours</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90, 365].map(d => (
            <button
              key={d}
              onClick={() => setJours(d)}
              className={`px-3 py-1.5 rounded text-sm ${
                jours === d ? 'bg-accent text-white' : 'bg-bg-elevated text-gray-400 hover:text-white'
              }`}
            >
              {d === 365 ? '1 an' : `${d}j`}
            </button>
          ))}
        </div>
      </header>

      {/* Cards top */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Valeur inventaire" value={fmt$(data.valeurInventaire)} tone="blue" />
        <StatCard label="Retraits" value={String(data.totalRetraits)} tone="red" sub={`${data.periode}j`} />
        <StatCard label="Stock bas" value={String(data.statut.bas)} tone="yellow" />
        <StatCard label="Rupture" value={String(data.statut.rupture)} tone="red" />
      </div>

      {/* Valeur vs objectif */}
      {data.valeurObjectif > 0 && (() => {
        const ecart = data.valeurAvecObjectif - data.valeurObjectif;
        const pct = Math.round((data.valeurAvecObjectif / data.valeurObjectif) * 100);
        const isAbove = ecart >= 0;
        return (
          <section className="card p-4">
            <h3 className="font-semibold text-gray-200 mb-3 text-sm">Valeur vs objectif (max)</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[140px]">
                <div className="text-xs text-gray-500 mb-0.5">Actuel</div>
                <div className="text-lg font-bold text-blue-400">{fmt$(data.valeurAvecObjectif)}</div>
              </div>
              <div className="flex-1 min-w-[140px]">
                <div className="text-xs text-gray-500 mb-0.5">Objectif (max)</div>
                <div className="text-lg font-bold text-gray-300">{fmt$(data.valeurObjectif)}</div>
              </div>
              <div className="flex-1 min-w-[140px]">
                <div className="text-xs text-gray-500 mb-0.5">Écart</div>
                <div className={`text-lg font-bold ${isAbove ? 'text-green-400' : 'text-red-400'}`}>
                  {isAbove ? '+' : ''}{fmt$(ecart)}
                </div>
                <div className={`text-xs ${isAbove ? 'text-green-600' : 'text-red-600'}`}>{pct}% de l'objectif</div>
              </div>
              <div className="w-full md:w-48">
                <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isAbove ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Donut statut */}
        <section className="card p-4">
          <h3 className="font-semibold text-gray-200 mb-3">Statut de l'inventaire</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={statutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {statutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 6 }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Top consommés */}
        <section className="card p-4">
          <h3 className="font-semibold text-gray-200 mb-3">Top 10 consommés</h3>
          {topData.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Aucun retrait sur cette période.
            </div>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={topData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis type="number" stroke="#6b7280" fontSize={11} />
                  <YAxis
                    type="category"
                    dataKey="nom"
                    width={120}
                    stroke="#9ca3af"
                    fontSize={10}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 6 }}
                    labelStyle={{ color: '#e5e7eb' }}
                    cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                  />
                  <Bar dataKey="total" fill={COLORS.accent} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* Consommation par jour */}
      <section className="card p-4">
        <h3 className="font-semibold text-gray-200 mb-3">Retraits par jour</h3>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={parJour}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={10} interval="preserveStartEnd" />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip
                contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke={COLORS.accent}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Dépenses en commandes ── */}
      {depenses && (
        <section className="card p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-200">Dépenses en commandes</h3>
            <p className="text-xs text-yellow-500/80 mt-0.5">
              ⚠ Valeurs approximatives — basées sur les prix actuels du catalogue, qui peuvent différer des prix au moment de la commande.
            </p>
          </div>

          {/* Cards totaux */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total commandé (approx.)" value={fmt$(depenses.totalCommandeApprox)} tone="blue" />
            <StatCard label="Total envoyé (approx.)" value={fmt$(depenses.totalEnvoyeApprox)} tone="green" />
            <StatCard label="Commandes créées" value={String(depenses.nbCommandes)} tone="blue" />
            <StatCard label="Commandes envoyées" value={String(depenses.nbCommandesEnvoyees)} tone="green" />
          </div>

          {/* Top produits par dépense */}
          {depenses.topDepenses.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Top produits commandés — par montant total</h4>
              <p className="text-xs text-gray-500 mb-3">Ces données peuvent vous aider à négocier des deals de volume avec vos fournisseurs.</p>
              {/* Mobile : cards */}
              <ul className="md:hidden space-y-2">
                {depenses.topDepenses.map((p, i) => (
                  <li key={p.codeSaq} className="bg-bg-elevated rounded-md px-3 py-2.5 flex items-start gap-3">
                    <span className="text-xs font-bold text-gray-500 w-5 shrink-0 mt-0.5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-200 truncate">{p.nom}</div>
                      <div className="text-xs text-gray-500 mt-0.5">SAQ {p.codeSaq} · {p.qteTotale} btl · {fmt$(p.prixUnitaire)}/btl</div>
                    </div>
                    <div className="text-sm font-bold text-green-400 shrink-0">{fmt$(p.totalDepense)}</div>
                  </li>
                ))}
              </ul>
              {/* Desktop : tableau */}
              <div className="hidden md:block overflow-x-auto">
                <table className="table-default w-full text-sm">
                  <thead>
                    <tr>
                      <th className="w-8">#</th>
                      <th className="text-left">Produit</th>
                      <th>Code SAQ</th>
                      <th>Qté totale</th>
                      <th>Prix / btl</th>
                      <th>Total approx.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depenses.topDepenses.map((p, i) => (
                      <tr key={p.codeSaq}>
                        <td className="text-center text-gray-500">{i + 1}</td>
                        <td className="max-w-[260px] truncate">{p.nom}</td>
                        <td className="text-center text-gray-400">{p.codeSaq}</td>
                        <td className="text-center">{p.qteTotale}</td>
                        <td className="text-center text-gray-400">{fmt$(p.prixUnitaire)}</td>
                        <td className="text-center font-semibold text-green-400">{fmt$(p.totalDepense)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'blue' | 'red' | 'yellow' | 'green' }) {
  const toneCls = {
    blue: 'text-blue-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
  }[tone];
  return (
    <div className="card p-3">
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-xl md:text-2xl font-bold ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
