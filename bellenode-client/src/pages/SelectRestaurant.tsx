import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Restaurant } from '../types';

export default function SelectRestaurant() {
  const { user, selectRestaurant, logout } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AuthApi.myRestaurants()
      .then(setRestaurants)
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (r: Restaurant) => {
    selectRestaurant(r);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Bellenode</h1>
          <p className="text-gray-400 mt-1">Bonjour, {user?.nom}</p>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Choisir un restaurant</h2>

          {loading ? (
            <p className="text-gray-400 text-center py-4">Chargement...</p>
          ) : restaurants.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Aucun restaurant assigné.</p>
          ) : (
            <ul className="space-y-2">
              {restaurants.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => handleSelect(r)}
                    className="w-full text-left px-4 py-3 rounded-lg bg-bg-elevated hover:bg-bg-card border border-gray-700 hover:border-accent text-white transition-colors"
                  >
                    {r.nom}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="mt-4 w-full text-center text-gray-500 hover:text-gray-300 text-sm"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
