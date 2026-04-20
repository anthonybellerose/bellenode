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
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-wider">BELLENODE</h1>
          <p className="text-gray-400 mt-2 text-sm">Bonjour, {user?.nom}</p>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-300 mb-4">Choisir un restaurant</h2>

          {loading ? (
            <p className="text-gray-400 text-center py-6">Chargement...</p>
          ) : restaurants.length === 0 ? (
            <p className="text-gray-400 text-center py-6">Aucun restaurant assigné.</p>
          ) : (
            <ul className="space-y-2">
              {restaurants.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => handleSelect(r)}
                    className="w-full text-left px-4 py-4 rounded-lg bg-bg-elevated active:bg-bg-border border border-gray-700 hover:border-accent text-white font-medium transition-colors min-h-[52px]"
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
          className="mt-5 w-full text-center text-gray-500 hover:text-gray-300 text-sm py-2"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
