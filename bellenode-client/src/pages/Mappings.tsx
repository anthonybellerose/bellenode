import { useEffect, useState } from 'react';
import { MappingsApi, ProductsApi } from '../api/client';
import type { CaisseMapping, Product } from '../types';
import UpcInputWithScanner from '../components/UpcInputWithScanner';
import BarcodeScanner from '../components/BarcodeScanner';

export default function Mappings() {
  const [mappings, setMappings] = useState<CaisseMapping[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CaisseMapping | null>(null);

  async function load() {
    setLoading(true);
    try {
      setMappings(await MappingsApi.list());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(m: Partial<CaisseMapping>) {
    try {
      if (editing?.id) {
        await MappingsApi.update(editing.id, m);
      } else {
        await MappingsApi.create(m);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) {
      alert('Erreur lors de l\'enregistrement. Vérifiez les données et réessayez.');
      console.error(err);
    }
  }

  async function remove(m: CaisseMapping) {
    if (!confirm(`Supprimer le mapping ${m.codeCaisse} ?`)) return;
    await MappingsApi.remove(m.id);
    load();
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="hidden md:block">
          <h2 className="page-title">Mappings caisses</h2>
          <p className="page-subtitle">
            Codes de caisses et leur équivalent en bouteilles : {mappings.length}
          </p>
        </div>
        <div className="flex gap-2 flex-1 md:flex-none">
          <input
            type="text"
            placeholder="Rechercher code ou nom..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 md:w-64"
          />
          <button
            className="btn btn-primary shrink-0"
            onClick={() => { setEditing(null); setShowForm(true); }}
          >
            + Nouveau
          </button>
        </div>
      </header>

      <section className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : mappings.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Aucun mapping défini.</div>
        ) : (() => {
          const s = search.trim().toLowerCase();
          const filtered = s
            ? mappings.filter(m =>
                m.codeCaisse.toLowerCase().includes(s) ||
                m.codeUnite.toLowerCase().includes(s) ||
                (m.nomUnite ?? '').toLowerCase().includes(s)
              )
            : mappings;
          return filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">Aucun résultat pour « {search} ».</div>
          ) : (
          <>
            {/* Mobile: cards */}
            <ul className="md:hidden divide-y divide-bg-border">
              {filtered.map((m) => (
                <li key={m.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[11px] text-gray-300 truncate">
                        📦 {m.codeCaisse}
                      </div>
                      <div className="font-mono text-[11px] text-gray-500 truncate">
                        → {m.codeUnite}
                      </div>
                      <div className="text-sm text-gray-200 truncate mt-0.5">
                        {m.nomUnite ?? <span className="text-gray-600">Inconnu</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl font-bold text-accent">× {m.quantite}</div>
                      <div className="flex gap-2 justify-end mt-1">
                        <button
                          className="text-accent text-xs px-2 py-1"
                          onClick={() => {
                            setEditing(m);
                            setShowForm(true);
                          }}
                        >
                          Éditer
                        </button>
                        <button
                          className="text-red-400 text-xs px-2 py-1"
                          onClick={() => remove(m)}
                        >
                          Suppr
                        </button>
                      </div>
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
                    <th>Code caisse</th>
                    <th>Code bouteille</th>
                    <th>Nom bouteille</th>
                    <th className="text-right">Quantité</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id}>
                      <td className="font-mono text-xs text-gray-300">{m.codeCaisse}</td>
                      <td className="font-mono text-xs text-gray-400">{m.codeUnite}</td>
                      <td className="text-gray-200">
                        {m.nomUnite ?? <span className="text-gray-600">-</span>}
                      </td>
                      <td className="text-right font-semibold text-accent">× {m.quantite}</td>
                      <td className="text-right">
                        <button
                          className="text-accent hover:text-accent-hover text-xs mr-2"
                          onClick={() => {
                            setEditing(m);
                            setShowForm(true);
                          }}
                        >
                          Éditer
                        </button>
                        <button
                          className="text-red-400 hover:text-red-300 text-xs"
                          onClick={() => remove(m)}
                        >
                          Suppr
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
          );
        })()}
      </section>

      {showForm && (
        <MappingForm
          initial={editing}
          onSave={save}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MappingForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: CaisseMapping | null;
  onSave: (m: Partial<CaisseMapping>) => Promise<void>;
  onCancel: () => void;
}) {
  const [codeCaisse, setCodeCaisse] = useState(initial?.codeCaisse ?? '');
  const [codeUnite, setCodeUnite] = useState(initial?.codeUnite ?? '');
  const [quantite, setQuantite] = useState(initial?.quantite.toString() ?? '12');
  const [saving, setSaving] = useState(false);

  const [uniteDisplay, setUniteDisplay] = useState(
    initial?.nomUnite
      ? `${initial.nomUnite} (${initial.codeUnite})`
      : (initial?.codeUnite ?? '')
  );
  const [uniteResults, setUniteResults] = useState<Product[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (uniteDisplay.trim().length < 2) { setUniteResults([]); return; }
    const t = setTimeout(async () => {
      const results = await ProductsApi.list(uniteDisplay);
      setUniteResults(results.slice(0, 8));
    }, 200);
    return () => clearTimeout(t);
  }, [uniteDisplay]);

  function selectProduct(p: Product) {
    setCodeUnite(p.codeUpc);
    setUniteDisplay(`${p.nom} (${p.codeUpc})`);
    setUniteResults([]);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg space-y-4">
        <h3 className="text-xl font-bold">{initial ? 'Modifier le mapping' : 'Nouveau mapping'}</h3>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Code de la caisse</label>
          <UpcInputWithScanner value={codeCaisse} onChange={setCodeCaisse} autoFocus />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Bouteille unitaire</label>
          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Rechercher par nom ou code..."
                value={uniteDisplay}
                onChange={e => {
                  setUniteDisplay(e.target.value);
                  setCodeUnite(e.target.value);
                }}
                className="flex-1"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                title={supported ? 'Scanner' : 'Caméra non supportée sur ce navigateur'}
                className={`btn px-3 flex-shrink-0 ${supported ? 'btn-secondary' : 'btn-ghost opacity-60'}`}
              >
                📷
              </button>
            </div>
            {uniteResults.length > 0 && (
              <ul className="absolute z-10 w-full bg-bg-elevated border border-bg-border rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
                {uniteResults.map(p => (
                  <li
                    key={p.codeUpc}
                    onMouseDown={() => selectProduct(p)}
                    className="px-3 py-2 cursor-pointer hover:bg-bg-card text-sm flex justify-between items-center gap-2"
                  >
                    <span className="text-gray-200 truncate">{p.nom}</span>
                    <span className="text-gray-500 text-xs font-mono shrink-0">{p.codeUpc}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {codeUnite && uniteDisplay !== codeUnite && (
            <p className="text-xs text-gray-500 mt-1 font-mono">→ {codeUnite}</p>
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Quantité par caisse</label>
          <input
            type="number"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button className="btn btn-ghost" onClick={onCancel}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({ codeCaisse, codeUnite, quantite: parseInt(quantite) || 1 });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {scannerOpen && (
        <BarcodeScanner
          mode="+"
          onModeChange={() => {}}
          showModeSwitch={false}
          onDetect={(code) => {
            setCodeUnite(code);
            setUniteDisplay(code);
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
