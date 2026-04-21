import { useState } from 'react';
import { AuthApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Profil() {
  const { user } = useAuth();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (newPassword.length < 8) {
      setMsg({ type: 'err', text: 'Le nouveau mot de passe doit avoir au moins 8 caractères.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: 'err', text: 'La confirmation ne correspond pas au nouveau mot de passe.' });
      return;
    }
    if (newPassword === currentPassword) {
      setMsg({ type: 'err', text: 'Le nouveau mot de passe doit être différent de l\'ancien.' });
      return;
    }

    setSubmitting(true);
    try {
      await AuthApi.changePassword(currentPassword, newPassword);
      setMsg({ type: 'ok', text: '✅ Mot de passe modifié.' });
      setCurrent(''); setNew(''); setConfirm('');
    } catch (e: any) {
      const err = e?.response?.data?.error ?? 'Erreur lors du changement.';
      setMsg({ type: 'err', text: err });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <header>
        <h2 className="page-title">Mon profil</h2>
        <p className="page-subtitle">{user?.nom} · {user?.email}</p>
      </header>

      <form onSubmit={submit} className="card p-5 space-y-4">
        <h3 className="font-semibold text-base text-gray-200">Changer le mot de passe</h3>

        {msg && (
          <div
            className={`text-sm p-2 rounded border ${
              msg.type === 'ok' ? 'border-green-700 text-green-300' : 'border-red-700 text-red-300'
            }`}
          >
            {msg.text}
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-400 mb-1">Mot de passe actuel</label>
          <input
            type={showPw ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Nouveau mot de passe (min 8)</label>
          <input
            type={showPw ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Confirmer</label>
          <input
            type={showPw ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-400 select-none">
          <input
            type="checkbox"
            checked={showPw}
            onChange={(e) => setShowPw(e.target.checked)}
            className="w-4 h-4"
          />
          Afficher les mots de passe
        </label>

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
          style={{ minHeight: 48 }}
        >
          {submitting ? 'Envoi…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}
