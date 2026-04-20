import { useEffect, useState } from 'react';
import { InventoryApi } from '../api/client';
import type { ObjectifRow, ObjectifStatut } from '../types';
import UpcInputWithScanner from '../components/UpcInputWithScanner';
import { useAuth } from '../context/AuthContext';

const statusLabels: Record<ObjectifStatut, { label: string; badge: string }> = {
  ok:      { label: 'OK',          badge: 'badge-green' },
  bas:     { label: 'Stock bas',   badge: 'badge-yellow' },
  rupture: { label: 'Rupture',     badge: 'badge-red' },
  ignore:  { label: 'Pas de cible', badge: 'badge-gray' },
};

type EditForm = { minQty: string; maxQty: string; lotQty: string };

export default function Objectifs() {
  const { isRestaurantAdmin } = useAuth();
  const [rows, setRows] = useState<ObjectifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ObjectifStatut | 'all' | 'alerte'>('alerte');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ObjectifRow | null>(null);
  const [form, setForm] = useState<EditForm>({ minQty: '', maxQty: '', lotQty: '' });

  async function load() {
    setLoading(true);
    try { setRows(await InventoryApi.objectifs()); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const counts = {
    all:     rows.length,
    alerte:  rows.filter(r => r.statut === 'bas' || r.statut === 'rupture').length,
    rupture: rows.filter(r => r.statut === 'rupture').length,
    bas:     rows.filter(r => r.statut === 'bas').length,
    ok:      rows.filter(r => r.statut === 'ok').length,
    ignore:  rows.filter(r => r.statut === 'ignore').length,
  };

  const filtered = rows.filter(r => {
    if (search.trim()) {
      const s = search.toLowerCase();
      return r.nom.toLowerCase().includes(s) || r.code.includes(s);
    }
    if (filter === 'alerte') return r.statut === 'bas' || r.statut === 'rupture';
    if (filter !== 'all') return r.statut === filter;
    return true;
  });

  function openEdit(r: ObjectifRow) {
    setEditing(r);
    setForm({
      minQty: r.minQty?.toString() ?? '',
      maxQty: r.maxQty?.toString() ?? '',
      lotQty: r.lotQty?.toString() ?? '1',
    });
  }

  async function saveEdit() {
    if (!editing) return;
    const min = form.minQty.trim() === '' ? 0 : parseInt(form.minQty);
    const max = form.maxQty.trim() === '' ? 0 : parseInt(form.maxQty);
    const lot = form.lotQty.trim() === '' ? 1 : parseInt(form.lotQty);
    if (isNaN(min) || isNaN(max) || isNaN(lot) || min < 0 || max < 0 || lot < 1) return;
    await InventoryApi.setObjectif(editing.code, { minQty: min, maxQty: max, lotQty: lot });
    setEditing(null);
    load();
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="hidden md:block">
        <h2 className="page-title">Objectifs de stock</h2>
        <p className="page-subtitle">
          Min / Max / Lot par produit — {counts.all} référencés, {counts.alerte} en alerte
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(['alerte','rupture','bas','ok','ignore','all'] as const).map(f => (
          <FilterBtn key={f} active={filter === f} onClick={() => setFilter(f)}
            tone={f === 'rupture' ? 'red' : f === 'bas' || f === 'alerte' ? 'yellow' : f === 'ok' ? 'green' : f === 'all' ? 'blue' : 'gray'}>
            {f === 'alerte' ? `⚠ Alertes (${counts.alerte})`
              : f === 'rupture' ? `Rupture (${counts.rupture})`
              : f === 'bas' ? `Bas (${counts.bas})`
              : f === 'ok' ? `OK (${counts.ok})`
              : f === 'ignore' ? `Sans cible (${counts.ignore})`
              : `Tout (${counts.all})`}
          </FilterBtn>
        ))}
      </div>

      <div className="md:max-w-md">
        <UpcInputWithScanner value={search} onChange={setSearch}
          placeholder="Rechercher par nom ou code..." type="search" />
      </div>

      <section className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            {filter === 'alerte' ? 'Aucune alerte. Tout est sous contrôle ! 🎉' : 'Aucun produit.'}
          </div>
        ) : (
          <>
            {/* Mobile */}
            <ul className="md:hidden divide-y divide-bg-border">
              {filtered.map(r => (
                <li key={r.productId}
                  onClick={() => isRestaurantAdmin && openEdit(r)}
                  className={`p-3 ${isRestaurantAdmin ? 'active:bg-bg-elevated cursor-pointer' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-100 truncate">{r.nom}</div>
                      <div className="text-[10px] font-mono text-gray-500 truncate">{r.code}</div>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className={`badge ${statusLabels[r.statut].badge}`}>{statusLabels[r.statut].label}</span>
                        {r.aCommander && <span className="text-xs text-orange-400 font-semibold">Commander {r.aCommander}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-0.5">
                      <div className="text-lg font-bold">
                        <span className={qtyColor(r)}>{r.qtyActuelle}</span>
                      </div>
                      {(r.minQty || r.maxQty) && (
                        <div className="text-[10px] text-gray-500">
                          min <span className="text-gray-300">{r.minQty ?? '—'}</span>
                          {' / '}max <span className="text-gray-300">{r.maxQty ?? '—'}</span>
                          {r.lotQty && r.lotQty > 1 && <span> · lot {r.lotQty}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop */}
            <div className="hidden md:block">
              <table className="table-default">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th className="text-right">Stock</th>
                    <th className="text-right">Min</th>
                    <th className="text-right">Max</th>
                    <th className="text-right">Lot</th>
                    <th className="text-right">À commander</th>
                    <th>Statut</th>
                    {isRestaurantAdmin && <th className="w-20"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.productId}>
                      <td>
                        <div className="text-gray-100">{r.nom}</div>
                        <div className="text-[10px] font-mono text-gray-500">{r.code}</div>
                      </td>
                      <td className={`text-right font-bold ${qtyColor(r)}`}>{r.qtyActuelle}</td>
                      <td className="text-right text-gray-300">{r.minQty ?? '—'}</td>
                      <td className="text-right text-accent font-semibold">{r.maxQty ?? '—'}</td>
                      <td className="text-right text-gray-400">{r.lotQty ?? '—'}</td>
                      <td className="text-right">
                        {r.aCommander
                          ? <span className="text-orange-400 font-semibold">{r.aCommander}</span>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td><span className={`badge ${statusLabels[r.statut].badge}`}>{statusLabels[r.statut].label}</span></td>
                      {isRestaurantAdmin && (
                        <td>
                          <button className="text-accent hover:text-accent-hover text-xs"
                            onClick={() => openEdit(r)}>Éditer</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card p-5 w-full max-w-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold">{editing.nom}</h3>
              <p className="text-xs font-mono text-gray-500">{editing.code}</p>
              <p className="text-sm text-gray-400 mt-1">Stock actuel : <strong className="text-white">{editing.qtyActuelle}</strong></p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(['minQty', 'maxQty', 'lotQty'] as const).map(field => (
                <div key={field}>
                  <label className="block text-xs text-gray-400 mb-1">
                    {field === 'minQty' ? 'Minimum' : field === 'maxQty' ? 'Maximum' : 'Lot'}
                  </label>
                  <input type="number" inputMode="numeric" min={field === 'lotQty' ? 1 : 0}
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={field === 'lotQty' ? '1' : '0'}
                    className="w-full text-center text-lg font-bold" style={{ minHeight: 48 }} />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Laisser Min et Max à 0 pour retirer l'objectif. Lot = quantité minimale de commande.
            </p>

            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setEditing(null)}>Annuler</button>
              <button className="btn btn-primary flex-1" onClick={saveEdit}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterBtn({ active, onClick, tone, children }: {
  active: boolean; onClick: () => void;
  tone: 'red' | 'yellow' | 'green' | 'gray' | 'blue'; children: React.ReactNode;
}) {
  const toneClass = active ? {
    red: 'bg-red-700 border-red-600 text-white',
    yellow: 'bg-yellow-700 border-yellow-600 text-white',
    green: 'bg-green-700 border-green-600 text-white',
    gray: 'bg-bg-elevated border-bg-border text-gray-200',
    blue: 'bg-accent border-transparent text-white',
  }[tone] : 'bg-bg-elevated border-bg-border text-gray-400 active:bg-bg-border';
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${toneClass}`}
      style={{ minHeight: 40 }}>
      {children}
    </button>
  );
}

function qtyColor(r: ObjectifRow): string {
  if (r.statut === 'rupture') return 'text-red-400';
  if (r.statut === 'bas') return 'text-yellow-400';
  if (r.statut === 'ok') return 'text-green-400';
  return 'text-gray-300';
}
