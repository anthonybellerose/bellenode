import { useEffect, useState } from 'react';
import { AdminApi } from '../../api/client';
import type { Restaurant } from '../../types';

export default function AdminRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [nom, setNom] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editNom, setEditNom] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => AdminApi.getRestaurants().then(setRestaurants).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;
    await AdminApi.createRestaurant(nom.trim());
    setNom('');
    load();
  };

  const handleUpdate = async (id: number) => {
    if (!editNom.trim()) return;
    await AdminApi.updateRestaurant(id, editNom.trim());
    setEditId(null);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Désactiver ce restaurant ?')) return;
    await AdminApi.deleteRestaurant(id);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Restaurants</h1>

      <form onSubmit={handleCreate} className="card p-4 mb-6 flex gap-2">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Nom du restaurant"
          className="flex-1 bg-bg border border-gray-700 rounded-lg px-3 py-2 text-white text-base focus:outline-none focus:border-accent"
        />
        <button type="submit" className="btn">Ajouter</button>
      </form>

      {loading ? (
        <p className="text-gray-400">Chargement...</p>
      ) : (
        <ul className="space-y-2">
          {restaurants.map((r) => (
            <li key={r.id} className="card p-4 flex items-center gap-3">
              {editId === r.id ? (
                <>
                  <input
                    value={editNom}
                    onChange={(e) => setEditNom(e.target.value)}
                    className="flex-1 bg-bg border border-gray-700 rounded px-2 py-1 text-white text-base focus:outline-none"
                  />
                  <button onClick={() => handleUpdate(r.id)} className="btn text-sm">Sauvegarder</button>
                  <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-white text-sm">Annuler</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-white">{r.nom}</span>
                  {!r.isActive && <span className="badge text-xs text-gray-500">Inactif</span>}
                  <button onClick={() => { setEditId(r.id); setEditNom(r.nom); }} className="text-accent hover:underline text-sm">Modifier</button>
                  {r.isActive && (
                    <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-300 text-sm">Désactiver</button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
