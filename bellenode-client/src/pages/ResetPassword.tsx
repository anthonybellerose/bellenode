import { useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { AuthApi } from '../api/client';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) { setErr('Mot de passe min 8 caractères.'); return; }
    if (pw !== confirm) { setErr('La confirmation ne correspond pas.'); return; }
    setLoading(true);
    try {
      await AuthApi.resetPassword(token, pw);
      setOk(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Erreur — lien peut-être expiré.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-[100dvh] bg-bg flex items-center justify-center px-5">
        <div className="card p-6 max-w-sm text-center space-y-3">
          <p className="text-red-400">Lien invalide — aucun token fourni.</p>
          <Link to="/forgot-password" className="btn btn-ghost">Redemander un lien</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-wider">BELLENODE</h1>
          <p className="text-gray-400 mt-2 text-sm">Nouveau mot de passe</p>
        </div>

        <div className="card p-6">
          {ok ? (
            <div className="space-y-3 text-center">
              <p className="text-green-400">✅ Mot de passe mis à jour.</p>
              <p className="text-gray-400 text-sm">Redirection vers la connexion…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Nouveau mot de passe (min 8)</label>
                <input type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required autoFocus className="w-full" autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Confirmer</label>
                <input type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="w-full" autoComplete="new-password" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-400 select-none">
                <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} className="w-4 h-4" />
                Afficher
              </label>
              {err && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2">{err}</p>}
              <button type="submit" disabled={loading} className="btn bg-accent hover:bg-blue-500 text-white w-full justify-center font-semibold">
                {loading ? 'Envoi…' : 'Enregistrer le mot de passe'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
