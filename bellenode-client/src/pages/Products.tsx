import { useEffect, useState } from 'react';
import { ProductsApi } from '../api/client';
import type { Product } from '../types';
import UpcInputWithScanner from '../components/UpcInputWithScanner';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    if (search.trim().length < 2) {
      setProducts([]);
      return;
    }
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
    try {
      if (editing && editing.id) {
        await ProductsApi.update(editing.id, p);
      } else {
        await ProductsApi.create(p);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) {
      alert('Erreur lors de la sauvegarde. Vérifie ta connexion et réessaie.');
      console.error(err);
    }
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
          <p className="page-subtitle">
            {search.trim().length < 2 ? 'Catalogue de plus de 25 000 produits' : `${products.length} résultat(s)`}
          </p>
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
        ) : search.trim().length < 2 ? (
          <div className="p-8 text-center text-gray-500">Tape au moins 2 caractères pour rechercher un produit (catalogue de {'>'}25 000 produits).</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun produit trouvé.</div>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="md:hidden divide-y divide-bg-border">
              {products.map((p) => (
                <li key={p.id} className="p-3 flex items-start gap-3">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.nom} className="w-12 h-12 object-contain rounded bg-white flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-bg-elevated flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-100 truncate">
                      {p.nom}
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer" className="text-accent ml-1">↗</a>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-gray-500 truncate">
                      UPC {p.codeUpc} · SAQ {p.codeSaq ?? '-'} {p.volume && `· ${p.volume}`}
                      {p.altCodes && <span className="text-gray-600"> · +{p.altCodes.split(';').filter(Boolean).length} code(s)</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-gray-200">
                      {p.prix != null ? `${p.prix.toFixed(2)}$` : '-'}
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
                    <th className="w-14"></th>
                    <th>UPC</th>
                    <th>Nom</th>
                    <th>Code SAQ</th>
                    <th>Volume</th>
                    <th className="text-right">Prix</th>
                    <th className="w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.nom} className="w-10 h-10 object-contain rounded bg-white" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-bg-elevated" />
                        )}
                      </td>
                      <td className="font-mono text-xs text-gray-400">{p.codeUpc}</td>
                      <td className="text-gray-100">
                        {p.nom}
                        {p.url && (
                          <a href={p.url} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover ml-1 text-xs">↗</a>
                        )}
                      </td>
                      <td className="font-mono text-xs text-gray-400">{p.codeSaq ?? '-'}</td>
                      <td className="text-xs text-gray-400">{p.volume ?? '-'}</td>
                      <td className="text-right text-gray-300">
                        {p.prix != null ? `${p.prix.toFixed(2)} $` : '-'}
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
  onSave: (p: Partial<Product>) => Promise<void>;
  onCancel: () => void;
}) {
  const [codeUpc, setCodeUpc] = useState(initial?.codeUpc ?? '');
  const [nom, setNom] = useState(initial?.nom ?? '');
  const [codeSaq, setCodeSaq] = useState(initial?.codeSaq ?? '');
  const [prix, setPrix] = useState<string>(initial?.prix?.toString() ?? '');
  const [lotQty, setLotQty] = useState<string>(initial?.lotQty?.toString() ?? '');
  const [altCodes, setAltCodes] = useState<string[]>(
    initial?.altCodes ? initial.altCodes.split(';').filter(Boolean) : []
  );
  const [altInput, setAltInput] = useState('');
  const [volume, setVolume] = useState(initial?.volume ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [saving, setSaving] = useState(false);

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
          <div>
            <label className="block text-sm text-gray-400 mb-1">Volume</label>
            <input type="text" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="750ml, 1L..." className="w-full" />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
          <div>
            <label className="block text-sm text-gray-400 mb-1">URL de l'image</label>
            <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="w-full" />
          </div>
          {imageUrl && (
            <img src={imageUrl} alt="aperçu" className="w-12 h-12 object-contain rounded bg-white mt-6" />
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Lien fiche produit (ex: SAQ)</label>
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.saq.com/fr/..." className="w-full" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Codes alternatifs (EAN, UPC variantes)</label>
          <div className="flex gap-2 mb-2">
            <UpcInputWithScanner
              value={altInput}
              onChange={setAltInput}
              placeholder="Scanner ou taper un code alternatif"
            />
            <button
              type="button"
              className="btn btn-ghost px-3 shrink-0"
              onClick={() => {
                const code = altInput.trim();
                if (code && !altCodes.includes(code)) setAltCodes(prev => [...prev, code]);
                setAltInput('');
              }}
            >
              + Ajouter
            </button>
          </div>
          {altCodes.length > 0 && (
            <ul className="space-y-1">
              {altCodes.map(c => (
                <li key={c} className="flex items-center gap-2 bg-bg-elevated rounded px-3 py-1">
                  <span className="font-mono text-xs text-gray-300 flex-1">{c}</span>
                  <button
                    type="button"
                    onClick={() => setAltCodes(prev => prev.filter(x => x !== c))}
                    className="text-red-400 text-xs hover:text-red-300"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
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
              await onSave({
                codeUpc,
                nom,
                codeSaq: codeSaq || null,
                prix: prix ? parseFloat(prix) : null,
                lotQty: lotQty ? parseInt(lotQty) : null,
                altCodes: altCodes.length > 0 ? altCodes.join(';') : null,
                volume: volume || null,
                imageUrl: imageUrl || null,
                url: url || null,
              });
              setSaving(false);
            }}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
