import { useEffect, useState } from 'react';
import api from '../../api/client';

type Employee = {
  userId: number;
  nom: string;
  email: string;
  restaurantRole: string;
  isSelf: boolean;
};

export default function AdminEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<Employee[]>('/restaurant-users');
      setEmployees(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (userId: number, role: string) => {
    await api.patch(`/restaurant-users/${userId}`, { restaurantRole: role });
    load();
  };

  const remove = async (userId: number, nom: string) => {
    if (!confirm(`Retirer ${nom} du restaurant ?`)) return;
    await api.delete(`/restaurant-users/${userId}`);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <header className="hidden md:block">
        <h2 className="page-title">Employés</h2>
        <p className="page-subtitle">Gérer les membres de votre restaurant</p>
      </header>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Chargement...</div>
      ) : employees.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 text-sm">Aucun utilisateur dans ce restaurant.</div>
      ) : (
        <ul className="space-y-2">
          {employees.map((e) => (
            <li key={e.userId} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium break-words">{e.nom}</div>
                <div className="text-gray-400 text-sm break-all">{e.email}</div>
              </div>
              {e.isSelf ? (
                <span className="text-xs text-accent px-2 py-1 border border-accent rounded self-start sm:self-auto">
                  {e.restaurantRole === 'Admin' ? 'Admin (vous)' : 'Employé (vous)'}
                </span>
              ) : (
                <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                  <select
                    value={e.restaurantRole}
                    onChange={(ev) => changeRole(e.userId, ev.target.value)}
                    className="bg-bg border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none">
                    <option value="User">Employé</option>
                    <option value="Admin">Admin</option>
                  </select>
                  <button
                    onClick={() => remove(e.userId, e.nom)}
                    className="text-red-400 hover:text-red-300 text-sm px-2">
                    Retirer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
