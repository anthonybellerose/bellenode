import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PublicApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Restaurant } from '../types';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [form, setForm] = useState({ nom: '', email: '', password: '', restaurantId: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    PublicApi.restaurants().then(setRestaurants);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await PublicApi.register({
        nom: form.nom,
        email: form.email,
        password: form.password,
        restaurantId: form.restaurantId ? parseInt(form.restaurantId) : undefined,
      });
      login(data.token, data.user);
      navigate('/select-restaurant');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-wider">BELLENODE</h1>
          <p className="text-gray-400 mt-2 text-sm">Créer un compte</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Nom</label>
              <input
                type="text"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="w-full"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Courriel</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full pr-12"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-white"
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Restaurant à rejoindre <span className="text-gray-600">(optionnel)</span>
              </label>
              <select
                value={form.restaurantId}
                onChange={(e) => setForm({ ...form, restaurantId: e.target.value })}
                className="w-full"
              >
                <option value="">— Choisir un restaurant —</option>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>{r.nom}</option>
                ))}
              </select>
              {form.restaurantId && (
                <p className="text-xs text-gray-500 mt-1">
                  Une demande d'accès sera envoyée à l'administrateur du restaurant.
                </p>
              )}
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn bg-accent hover:bg-blue-500 text-white w-full justify-center font-semibold"
            >
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-gray-500 text-sm">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-accent hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
