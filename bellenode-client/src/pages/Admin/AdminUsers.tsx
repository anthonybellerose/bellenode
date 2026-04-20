import { useEffect, useState } from 'react';
import { AdminApi } from '../../api/client';
import type { Restaurant, UserWithAccess } from '../../types';

export default function AdminUsers() {
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserWithAccess | null>(null);

  const emptyForm = { email: '', nom: '', password: '', role: 'User', restaurantIds: [] as number[] };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const [u, r] = await Promise.all([AdminApi.getUsers(), AdminApi.getRestaurants()]);
    setUsers(u);
    setRestaurants(r);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyForm); setEditUser(null); setShowForm(true); };
  const openEdit = (u: UserWithAccess) => {
    setForm({ email: u.email, nom: u.nom, password: '', role: u.role, restaurantIds: u.restaurants.map((r) => r.restaurantId) });
    setEditUser(u);
    setShowForm(true);
  };

  const toggleRestaurant = (id: number) => {
    setForm((f) => ({
      ...f,
      restaurantIds: f.restaurantIds.includes(id) ? f.restaurantIds.filter((r) => r !== id) : [...f.restaurantIds, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editUser) {
      await AdminApi.updateUser(editUser.id, { ...form, restaurantIds: form.restaurantIds });
    } else {
      await AdminApi.createUser({ ...form, restaurantIds: form.restaurantIds });
    }
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    await AdminApi.deleteUser(id);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Utilisateurs</h1>
        <button onClick={openCreate} className="btn">+ Ajouter</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 mb-6 space-y-3">
          <h2 className="text-lg font-semibold text-white">{editUser ? 'Modifier' : 'Nouvel utilisateur'}</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400">Nom</label>
              <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="w-full bg-bg border border-gray-700 rounded px-2 py-1 text-white text-base focus:outline-none mt-1" required />
            </div>
            <div>
              <label className="text-xs text-gray-400">Courriel</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-bg border border-gray-700 rounded px-2 py-1 text-white text-base focus:outline-none mt-1" required />
            </div>
            <div>
              <label className="text-xs text-gray-400">{editUser ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe'}</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-bg border border-gray-700 rounded px-2 py-1 text-white text-base focus:outline-none mt-1"
                required={!editUser} />
            </div>
            <div>
              <label className="text-xs text-gray-400">Rôle</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full bg-bg border border-gray-700 rounded px-2 py-1 text-white text-base focus:outline-none mt-1">
                <option value="User">Utilisateur</option>
                <option value="SuperAdmin">Super Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Restaurants</label>
            <div className="flex flex-wrap gap-2">
              {restaurants.map((r) => (
                <button type="button" key={r.id}
                  onClick={() => toggleRestaurant(r.id)}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${form.restaurantIds.includes(r.id) ? 'bg-accent text-white border-accent' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>
                  {r.nom}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn">{editUser ? 'Sauvegarder' : 'Créer'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-sm px-3">Annuler</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400">Chargement...</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-white font-medium">{u.nom}</span>
                  <span className="text-gray-400 text-sm ml-2">{u.email}</span>
                  {u.role === 'SuperAdmin' && <span className="badge ml-2 text-xs text-accent">Super Admin</span>}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => openEdit(u)} className="text-accent hover:underline text-sm">Modifier</button>
                  <button onClick={() => handleDelete(u.id)} className="text-red-400 hover:text-red-300 text-sm">Supprimer</button>
                </div>
              </div>
              {u.restaurants.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {u.restaurants.map((r) => (
                    <span key={r.restaurantId} className="text-xs text-gray-500 bg-bg px-2 py-0.5 rounded">{r.nom}</span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
