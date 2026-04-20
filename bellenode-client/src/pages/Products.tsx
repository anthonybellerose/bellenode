import { useEffect, useState } from 'react';
import { ProductsApi } from '../api/client';
import type { Product } from '../types';
import UpcInputWithScanner from '../components/UpcInputWithScanner';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setProducts(await ProductsApi.list(search));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [search]);

  async function save(p: Partial<Product>) {
    if (editing && editing.id) {
      await ProductsApi.update(editing.id, p);
    } else {
      await ProductsApi.create(p);
    }
    setShowForm(false);
    setEditing(null);
    load();
  }

  async function remove(p: Product) {
    if (!confirm(`Supprimer "${p.nom}" ?`)) return;
    await ProductsApi.remove(p.id);
    load();
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="hidden md:flex items-center justify-between">
        <div>
          <h2 className="page-title">Produits</h2>
          <p className="page-subtitle">Catalogue des bouteilles — {products.length} produit(s)</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + Ajouter un produit
        </button>
      </header>

      <div className="flex gap-2 items-start">
        <div className="flex-1 md:max-w-md">
          <UpcInputWithScanner
            value={search}
            onChange={setSearch}
            placeholder="Rechercher nom, UPC, SAQ..."
            type="search"
          />
        </div>
        <button
          className="btn btn-primary md:hidden px-4 flex-shrink-0"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          +
        </button>
      </div>

      <section className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun produit.</div>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="md:hidden divide-y divide-bg-border">
              {products.map((p) => (
                <li key={p.id} className="p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-100 truncate">{p.nom}</div>
                    <div className="font-mono text-[10px] text-gray-500 truncate">
                      UPC {p.codeUpc} · SAQ {p.codeSaq ?? '—'}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-gray-200">
                      {p.prix != null ? `${p.prix.toFixed(2)}$` : '—'}
                    </div>
                    <div className="flex gap-2 mt-1 justify-end">
                      <button
                        className="text-accent text-xs px-2 py-1"
                        onClick={() => {
                          setEditing(p);
                          setShowForm(true);
                        }}
                      >
                        Éditer
                      </button>
                      <button
                        className="text-red-400 text-xs px-2 py-1"
                        onClick={() => remove(p)}
                      >
                        Suppr
                      </button>
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
                    <th>UPC</th>
                    <th>Nom</th>
                    <th>Code SAQ</th>
                    <th className="text-right">Prix</th>
                    <th className="w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs text-gray-400">{p.codeUpc}</td>
                      <td className="text-gray-100">{p.nom}</td>
                      <td className="font-mono text-xs text-gray-400">{p.codeSaq ?? '—'}</td>
                      <td className="text-right text-gray-300">
                        {p.prix != null ? `${p.prix.toFixed(2)} $` : '—'}
                      </td>
                      <td className="text-right">
                        <button
                          className="text-accent hover:text-accent-hover text-xs mr-2"
                          onClick={() => {
                            setEditing(p);
                            setShowForm(true);
                          }}
                        >
                          Éditer
                        </button>
                        <button
                          className="text-red-400 hover:text-red-300 text-xs"
                          onClick={() => remove(p)}
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
        )}
      </section>

      {showForm && (
        <ProductForm
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

function ProductForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Product | null;
  onSave: (p: Partial<Product>) => void;
  onCancel: () => void;
}) {
  const [codeUpc, setCodeUpc] = useState(initial?.codeUpc ?? '');
  const [nom, setNom] = useState(initial?.nom ?? '');
  const [codeSaq, setCodeSaq] = useState(initial?.codeSaq ?? '');
  const [prix, setPrix] = useState<string>(initial?.prix?.toString() ?? '');
  const [lotQty, setLotQty] = useState<string>(initial?.lotQty?.toString() ?? '');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 md:items-center items-end">
      <div className="card p-6 w-full max-w-lg space-y-4">
        <h3 className="text-xl font-bold">
          {initial ? 'Modifier le produit' : 'Nouveau produit'}
        </h3>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Code UPC</label>
          <UpcInputWithScanner value={codeUpc} onChange={setCodeUpc} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Nom</label>
          <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} className="w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Code SAQ</label>
            <input type="text" value={codeSaq ?? ''} onChange={(e) => setCodeSaq(e.target.value)} className="w-full font-mono" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Prix ($)</label>
            <input type="number" step="0.01" value={prix} onChange={(e) => setPrix(e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Lot par défaut</label>
            <input type="number" min="1" value={lotQty} onChange={(e) => setLotQty(e.target.value)} placeholder="1" className="w-full" />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button className="btn btn-ghost" onClick={onCancel}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              onSave({
                codeUpc,
                nom,
                codeSaq: codeSaq || null,
                prix: prix ? parseFloat(prix) : null,
                lotQty: lotQty ? parseInt(lotQty) : null,
              })
            }
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
