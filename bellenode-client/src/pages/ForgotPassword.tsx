import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthApi } from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await AuthApi.forgotPassword(email);
      setDone(true);
    } catch {
      // Réponse 200 même si email inconnu — on affiche quand même le message
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-wider">BELLENODE</h1>
          <p className="text-gray-400 mt-2 text-sm">Mot de passe oublié</p>
        </div>

        <div className="card p-6">
          {done ? (
            <div className="space-y-4 text-center">
              <p className="text-green-400">
                ✅ Si ce courriel existe, tu recevras un lien de réinitialisation dans quelques instants.
              </p>
              <p className="text-gray-400 text-sm">Regarde ta boîte de réception (et les indésirables).</p>
              <Link to="/login" className="btn btn-ghost w-full">Retour à la connexion</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <p className="text-sm text-gray-400">
                Entre ton courriel — on t'enverra un lien pour choisir un nouveau mot de passe.
              </p>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Courriel</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  className="w-full"
                />
              </div>
              <button type="submit" disabled={loading} className="btn bg-accent hover:bg-blue-500 text-white w-full justify-center font-semibold">
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </button>
              <Link to="/login" className="block text-center text-gray-400 text-sm hover:text-white">
                ← Retour à la connexion
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
