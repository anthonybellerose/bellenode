import { useEffect, useState } from 'react';
import { InventoryApi, ProductsApi } from '../api/client';
import type { InventoryRow } from '../types';

export default function NonReferenced() {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<InventoryRow | null>(null);
  const [nom, setNom] = useState('');
  const [prix, setPrix] = useState('');
  const [codeSaq, setCodeSaq] = useState('');

  async function load() {
    setLoading(true);
    try {
      setItems(await InventoryApi.nonReferenced());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addToProducts() {
    if (!adding) return;
    await ProductsApi.create({
      codeUpc: adding.code,
      nom,
      codeSaq: codeSaq || null,
      prix: prix ? parseFloat(prix) : null,
    });
    setAdding(null);
    setNom('');
    setPrix('');
    setCodeSaq('');
    load();
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-white">Produits non référencés</h2>
        <p className="text-gray-400 mt-1">Codes scannés qui ne sont pas encore dans le catalogue — {items.length}</p>
      </header>

      <section className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucun produit non référencé. Tout ce qui est scanné est connu ! 🎉
          </div>
        ) : (
          <table className="table-default">
            <thead>
              <tr>
                <th>Code UPC</th>
                <th className="text-right">Quantité en stock</th>
                <th>Dernière maj</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="font-mono text-gray-300">{item.code}</td>
                  <td className="text-right font-semibold text-yellow-400">{item.quantite}</td>
                  <td className="text-gray-500 text-xs">
                    {new Date(item.updatedAt).toLocaleString('fr-CA')}
                  </td>
                  <td className="text-right">
                    <button
                      className="btn btn-primary text-xs px-3 py-1"
                      onClick={() => {
                        setAdding(item);
                        setNom('');
                        setPrix('');
                        setCodeSaq('');
                      }}
                    >
                      Ajouter au catalogue
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {adding && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-lg space-y-4">
            <h3 className="text-xl font-bold">Ajouter au catalogue</h3>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Code UPC</label>
              <input type="text" value={adding.code} disabled className="w-full font-mono bg-bg" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nom du produit</label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="w-full"
                autoFocus
                placeholder="Ex: Vodka Absolut - 750ml"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Code SAQ</label>
                <input type="text" value={codeSaq} onChange={(e) => setCodeSaq(e.target.value)} className="w-full font-mono" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Prix ($)</label>
                <input type="number" step="0.01" value={prix} onChange={(e) => setPrix(e.target.value)} className="w-full" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button className="btn btn-ghost" onClick={() => setAdding(null)}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={addToProducts} disabled={!nom}>
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
