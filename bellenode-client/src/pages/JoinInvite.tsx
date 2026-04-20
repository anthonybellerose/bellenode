import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { PublicApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function JoinInvite() {
  const { login, selectRestaurant } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [restaurantNom, setRestaurantNom] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [form, setForm] = useState({ nom: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setTokenValid(false); return; }
    PublicApi.inviteInfo(token)
      .then((data) => { setRestaurantNom(data.restaurantNom); setTokenValid(true); })
      .catch(() => setTokenValid(false));
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await PublicApi.registerWithInvite({ ...form, token });
      login(data.token, data.user);
      selectRestaurant({ id: data.restaurant.id, nom: data.restaurant.nom, restaurantRole: 'User' });
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="min-h-[100dvh] bg-bg flex items-center justify-center">
        <p className="text-gray-400">Vérification du lien...</p>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center px-5">
        <div className="text-center">
          <p className="text-2xl mb-2">❌</p>
          <p className="text-white font-semibold mb-1">Lien invalide ou expiré</p>
          <p className="text-gray-400 text-sm mb-6">Ce lien d'invitation n'est plus valide.</p>
          <Link to="/login" className="text-accent hover:underline text-sm">Retour à la connexion</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-wider">BELLENODE</h1>
          <p className="text-gray-400 mt-2 text-sm">
            Invitation pour <span className="text-white font-medium">{restaurantNom}</span>
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Nom</label>
              <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="w-full" required autoFocus />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Courriel</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full" required autoComplete="email" />
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
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-white" tabIndex={-1}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading} className="btn bg-accent hover:bg-blue-500 text-white w-full justify-center font-semibold">
              {loading ? 'Création...' : `Rejoindre ${restaurantNom}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
