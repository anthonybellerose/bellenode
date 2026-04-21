import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { StatsApi, type StatsData } from '../api/client';

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

  useEffect(() => {
    setLoading(true);
    StatsApi.get(jours).then(setData).finally(() => setLoading(false));
  }, [jours]);

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
