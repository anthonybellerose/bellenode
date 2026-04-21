import { useEffect, useState } from 'react';
import { AdminApi } from '../../api/client';
import type { Restaurant, UserWithAccess } from '../../types';

export default function AdminUsers() {
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserWithAccess | null>(null);

  type RestaurantAssignment = { restaurantId: number; restaurantRole: string };
  const emptyForm = { email: '', nom: '', password: '', role: 'User', restaurants: [] as RestaurantAssignment[] };
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
    setForm({ email: u.email, nom: u.nom, password: '', role: u.role, restaurants: u.restaurants.map((r) => ({ restaurantId: r.restaurantId, restaurantRole: r.restaurantRole })) });
    setEditUser(u);
    setShowForm(true);
  };

  const toggleRestaurant = (id: number) => {
    setForm((f) => {
      const exists = f.restaurants.find((r) => r.restaurantId === id);
      return {
        ...f,
        restaurants: exists ? f.restaurants.filter((r) => r.restaurantId !== id) : [...f.restaurants, { restaurantId: id, restaurantRole: 'User' }],
      };
    });
  };

  const setRestaurantRole = (id: number, role: string) => {
    setForm((f) => ({
      ...f,
      restaurants: f.restaurants.map((r) => r.restaurantId === id ? { ...r, restaurantRole: role } : r),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editUser) {
      await AdminApi.updateUser(editUser.id, { ...form });
    } else {
      await AdminApi.createUser({ ...form });
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
            <div className="space-y-2">
              {restaurants.map((r) => {
                const assignment = form.restaurants.find((a) => a.restaurantId === r.id);
                const selected = !!assignment;
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <button type="button"
                      onClick={() => toggleRestaurant(r.id)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${selected ? 'bg-accent text-white border-accent' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>
                      {r.nom}
                    </button>
                    {selected && (
                      <select
                        value={assignment.restaurantRole}
                        onChange={(e) => setRestaurantRole(r.id, e.target.value)}
                        className="bg-bg border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none">
                        <option value="User">Employé</option>
                        <option value="Admin">Admin</option>
                      </select>
                    )}
                  </div>
                );
              })}
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
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-white font-medium break-words">{u.nom}</span>
                    {u.role === 'SuperAdmin' && <span className="badge text-xs text-accent">Super Admin</span>}
                  </div>
                  <div className="text-gray-400 text-sm break-all">{u.email}</div>
                </div>
                <div className="flex gap-4 shrink-0 self-start">
                  <button onClick={() => openEdit(u)} className="text-accent hover:underline text-sm">Modifier</button>
                  <button onClick={() => handleDelete(u.id)} className="text-red-400 hover:text-red-300 text-sm">Supprimer</button>
                </div>
              </div>
              {u.restaurants.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {u.restaurants.map((r) => (
                    <span key={r.restaurantId} className="text-xs text-gray-500 bg-bg px-2 py-0.5 rounded">
                      {r.nom}
                      {r.restaurantRole === 'Admin' && <span className="ml-1 text-accent font-semibold">· Admin</span>}
                    </span>
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
