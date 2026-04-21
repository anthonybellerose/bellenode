import { useEffect, useState } from 'react';
import { InventoryApi } from '../api/client';
import type { ObjectifRow, ObjectifStatut } from '../types';
import UpcInputWithScanner from '../components/UpcInputWithScanner';
import { useAuth } from '../context/AuthContext';

const statusLabels: Record<ObjectifStatut | 'ignore', { label: string; badge: string }> = {
  ok:      { label: 'OK',           badge: 'badge-green' },
  bas:     { label: 'Stock bas',    badge: 'badge-yellow' },
  rupture: { label: 'Rupture',      badge: 'badge-red' },
  ignore:  { label: 'Sans objectif', badge: 'badge-gray' },
};

type EditForm = { minQty: string; maxQty: string; lotQty: string };

export default function Inventaire() {
  const { isRestaurantAdmin } = useAuth();
  const [rows, setRows] = useState<ObjectifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ObjectifStatut | 'all' | 'alerte' | 'ignore'>('all');
  const [search, setSearch] = useState('');
  const [inventoryOnly, setInventoryOnly] = useState(true);
  const [editing, setEditing] = useState<ObjectifRow | null>(null);
  const [form, setForm] = useState<EditForm>({ minQty: '', maxQty: '', lotQty: '' });

  async function load() {
    setLoading(true);
    try { setRows(await InventoryApi.objectifs({ inventoryOnly })); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [inventoryOnly]);

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
      lotQty: r.lotQty?.toString() ?? '',
    });
  }

  async function saveEdit() {
    if (!editing) return;
    const min = form.minQty.trim() === '' ? 0 : parseInt(form.minQty);
    const max = form.maxQty.trim() === '' ? 0 : parseInt(form.maxQty);
    const lotRaw = form.lotQty.trim();
    const lot = lotRaw === '' ? null : parseInt(lotRaw);
    if (isNaN(min) || isNaN(max) || (lot !== null && isNaN(lot)) || min < 0 || max < 0 || (lot !== null && lot < 1)) return;
    await InventoryApi.setObjectif(editing.code, { minQty: min, maxQty: max, lotQty: lot });
    setEditing(null);
    load();
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="hidden md:flex items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Inventaire</h2>
          <p className="page-subtitle">
            {rows.length} produits scannés · {counts.alerte} en alerte
          </p>
        </div>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            try {
              const dateStr = new Date().toISOString().slice(0, 10);
              await InventoryApi.exportExcel(`inventaire-${dateStr}.xlsx`);
            } catch { alert('Erreur lors de l\'export.'); }
          }}
        >
          📊 Exporter Excel
        </button>
      </header>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          className="btn btn-ghost text-sm md:hidden"
          onClick={async () => {
            try {
              const dateStr = new Date().toISOString().slice(0, 10);
              await InventoryApi.exportExcel(`inventaire-${dateStr}.xlsx`);
            } catch { alert('Erreur lors de l\'export.'); }
          }}
        >
          📊 Export
        </button>
        {([
          { key: 'all',     label: `Tout (${counts.all})`,          tone: 'blue' },
          { key: 'alerte',  label: `⚠ Alertes (${counts.alerte})`,  tone: 'yellow' },
          { key: 'rupture', label: `Rupture (${counts.rupture})`,    tone: 'red' },
          { key: 'bas',     label: `Stock bas (${counts.bas})`,      tone: 'yellow' },
          { key: 'ok',      label: `OK (${counts.ok})`,              tone: 'green' },
          { key: 'ignore',  label: `Sans objectif (${counts.ignore})`, tone: 'gray' },
        ] as const).map(({ key, label, tone }) => (
          <FilterBtn key={key} active={filter === key} onClick={() => setFilter(key)} tone={tone}>
            {label}
          </FilterBtn>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 md:max-w-md">
          <UpcInputWithScanner value={search} onChange={setSearch}
            placeholder="Rechercher par nom ou code..." type="search" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={!inventoryOnly}
            onChange={(e) => setInventoryOnly(!e.target.checked)}
            className="w-4 h-4"
          />
          Afficher tous les produits
        </label>
      </div>

      <section className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Aucun produit trouvé.</div>
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
                      <div className="text-[10px] font-mono text-gray-500">{r.code}</div>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className={`badge ${statusLabels[r.statut].badge}`}>{statusLabels[r.statut].label}</span>
                        {r.aCommander != null && (
                          <span className="text-xs text-orange-400 font-semibold">Commander {r.aCommander}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-2xl font-bold ${qtyColor(r)}`}>{r.qtyActuelle}</div>
                      {(r.minQty != null || r.maxQty != null) && (
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          <span className="text-gray-400">{r.minQty ?? '—'}</span>
                          <span className="text-gray-600"> / </span>
                          <span className="text-accent">{r.maxQty ?? '—'}</span>
                          {r.lotEffectif > 1 && <span className="text-gray-600"> ×{r.lotEffectif}</span>}
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
                      <td className="text-right text-gray-400">
                        {r.lotEffectif > 1 ? (
                          <span title={r.lotQty == null ? `Défaut produit: ${r.lotDefault}` : 'Override resto'}>
                            {r.lotEffectif}{r.lotQty == null && r.lotDefault != null && <span className="text-gray-600 text-[10px]"> *</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="text-right">
                        {r.aCommander != null
                          ? <span className="text-orange-400 font-semibold">{r.aCommander}</span>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td><span className={`badge ${statusLabels[r.statut].badge}`}>{statusLabels[r.statut].label}</span></td>
                      {isRestaurantAdmin && (
                        <td>
                          <button className="text-accent hover:text-accent-hover text-xs" onClick={() => openEdit(r)}>
                            Objectif
                          </button>
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

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card p-5 w-full max-w-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold">{editing.nom}</h3>
              <p className="text-xs font-mono text-gray-500">{editing.code}</p>
              <p className="text-sm text-gray-400 mt-1">Stock actuel : <strong className="text-white">{editing.qtyActuelle}</strong></p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                { field: 'minQty', label: 'Minimum' },
                { field: 'maxQty', label: 'Maximum' },
                { field: 'lotQty', label: `Lot${editing.lotDefault ? ` (défaut: ${editing.lotDefault})` : ''}` },
              ] as const).map(({ field, label }) => (
                <div key={field}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input type="number" inputMode="numeric" min={field === 'lotQty' ? 1 : 0}
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={field === 'lotQty' ? (editing.lotDefault?.toString() ?? '1') : '0'}
                    className="w-full text-center text-lg font-bold" style={{ minHeight: 48 }} />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Min=0 et Max=0 retire l'objectif. Lot vide = utiliser le lot par défaut du produit.
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
  const cls = active ? {
    red: 'bg-red-700 border-red-600 text-white',
    yellow: 'bg-yellow-700 border-yellow-600 text-white',
    green: 'bg-green-700 border-green-600 text-white',
    gray: 'bg-bg-elevated border-bg-border text-gray-200',
    blue: 'bg-accent border-transparent text-white',
  }[tone] : 'bg-bg-elevated border-bg-border text-gray-400 active:bg-bg-border';
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${cls}`}
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
