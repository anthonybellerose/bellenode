import { useEffect, useState } from 'react';
import { InventoryApi } from '../api/client';
import type { ObjectifRow, ObjectifStatut } from '../types';
import UpcInputWithScanner from '../components/UpcInputWithScanner';

const statusLabels: Record<ObjectifStatut, { label: string; badge: string }> = {
  ok: { label: 'OK', badge: 'badge-green' },
  bas: { label: 'Stock bas', badge: 'badge-yellow' },
  rupture: { label: 'Rupture', badge: 'badge-red' },
  ignore: { label: 'Pas de cible', badge: 'badge-gray' },
};

export default function Objectifs() {
  const [rows, setRows] = useState<ObjectifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ObjectifStatut | 'all' | 'alerte'>('alerte');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ObjectifRow | null>(null);
  const [editValue, setEditValue] = useState('');

  async function load() {
    setLoading(true);
    try {
      setRows(await InventoryApi.objectifs());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const searchActive = search.trim().length > 0;
  const filtered = rows.filter((r) => {
    if (!searchActive) {
      if (filter === 'alerte') {
        if (r.statut !== 'bas' && r.statut !== 'rupture') return false;
      } else if (filter !== 'all' && r.statut !== filter) {
        return false;
      }
    }
    if (searchActive) {
      const s = search.toLowerCase();
      if (!r.nom.toLowerCase().includes(s) && !r.code.includes(s)) return false;
    }
    return true;
  });

  const counts = {
    all: rows.length,
    alerte: rows.filter((r) => r.statut === 'bas' || r.statut === 'rupture').length,
    rupture: rows.filter((r) => r.statut === 'rupture').length,
    bas: rows.filter((r) => r.statut === 'bas').length,
    ok: rows.filter((r) => r.statut === 'ok').length,
    ignore: rows.filter((r) => r.statut === 'ignore').length,
  };

  async function saveEdit() {
    if (!editing) return;
    const val = editValue.trim() === '' ? null : parseInt(editValue);
    if (val != null && (isNaN(val) || val < 0)) return;
    await InventoryApi.setObjectif(editing.code, val);
    setEditing(null);
    load();
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="hidden md:block">
        <h2 className="page-title">Objectifs de stock</h2>
        <p className="page-subtitle">
          Quantités cibles par produit — {counts.all} référencés, {counts.alerte} en alerte
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <FilterBtn active={filter === 'alerte'} onClick={() => setFilter('alerte')} tone="yellow">
          ⚠ Alertes ({counts.alerte})
        </FilterBtn>
        <FilterBtn active={filter === 'rupture'} onClick={() => setFilter('rupture')} tone="red">
          Rupture ({counts.rupture})
        </FilterBtn>
        <FilterBtn active={filter === 'bas'} onClick={() => setFilter('bas')} tone="yellow">
          Bas ({counts.bas})
        </FilterBtn>
        <FilterBtn active={filter === 'ok'} onClick={() => setFilter('ok')} tone="green">
          OK ({counts.ok})
        </FilterBtn>
        <FilterBtn active={filter === 'ignore'} onClick={() => setFilter('ignore')} tone="gray">
          Sans cible ({counts.ignore})
        </FilterBtn>
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')} tone="blue">
          Tout ({counts.all})
        </FilterBtn>
      </div>

      <div className="md:max-w-md">
        <UpcInputWithScanner
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par nom ou code..."
          type="search"
        />
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
            {/* Mobile: cards */}
            <ul className="md:hidden divide-y divide-bg-border">
              {filtered.map((r) => (
                <li
                  key={r.productId}
                  onClick={() => {
                    setEditing(r);
                    setEditValue(r.objectifQty?.toString() ?? '');
                  }}
                  className="p-3 active:bg-bg-elevated cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-100 truncate">{r.nom}</div>
                      <div className="text-[10px] font-mono text-gray-500 truncate">{r.code}</div>
                      <div className="mt-1">
                        <span className={`badge ${statusLabels[r.statut].badge}`}>
                          {statusLabels[r.statut].label}
                        </span>
                        {r.manque > 0 && (
                          <span className="text-xs text-yellow-400 ml-2">Manque {r.manque}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold">
                        <span className={qtyColor(r)}>{r.qtyActuelle}</span>
                        <span className="text-gray-600 text-sm"> / </span>
                        <span className="text-accent">{r.objectifQty ?? '—'}</span>
                      </div>
                      <div className="text-[10px] text-gray-500">actuel / cible</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block">
              <table className="table-default">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th className="text-right">Stock</th>
                    <th className="text-right">Cible</th>
                    <th className="text-right">Manque</th>
                    <th>Statut</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.productId}>
                      <td>
                        <div className="text-gray-100">{r.nom}</div>
                        <div className="text-[10px] font-mono text-gray-500">{r.code}</div>
                      </td>
                      <td className={`text-right font-bold ${qtyColor(r)}`}>{r.qtyActuelle}</td>
                      <td className="text-right text-accent font-semibold">{r.objectifQty ?? '—'}</td>
                      <td className="text-right">
                        {r.manque > 0 ? (
                          <span className="text-yellow-400">−{r.manque}</span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${statusLabels[r.statut].badge}`}>
                          {statusLabels[r.statut].label}
                        </span>
                      </td>
                      <td>
                        <button
                          className="text-accent hover:text-accent-hover text-xs"
                          onClick={() => {
                            setEditing(r);
                            setEditValue(r.objectifQty?.toString() ?? '');
                          }}
                        >
                          Éditer
                        </button>
                      </td>
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
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Quantité cible</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
                className="w-full text-xl text-center font-bold"
                style={{ minHeight: 56 }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Stock actuel: <strong className="text-white">{editing.qtyActuelle}</strong> · Laisser vide pour
                retirer l'objectif
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setEditing(null)}>
                Annuler
              </button>
              <button className="btn btn-primary flex-1" onClick={saveEdit}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: 'red' | 'yellow' | 'green' | 'gray' | 'blue';
  children: React.ReactNode;
}) {
  const toneClass = active
    ? {
        red: 'bg-red-700 border-red-600 text-white',
        yellow: 'bg-yellow-700 border-yellow-600 text-white',
        green: 'bg-green-700 border-green-600 text-white',
        gray: 'bg-bg-elevated border-bg-border text-gray-200',
        blue: 'bg-accent border-transparent text-white',
      }[tone]
    : 'bg-bg-elevated border-bg-border text-gray-400 active:bg-bg-border';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${toneClass}`}
      style={{ minHeight: 40 }}
    >
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
