import { useEffect, useState } from 'react';
import { InvitesApi } from '../../api/client';
import type { InviteToken } from '../../types';

export default function Invites() {
  const [invites, setInvites] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => InvitesApi.list().then(setInvites).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const generate = async () => {
    await InvitesApi.create();
    load();
  };

  const revoke = async (id: number) => {
    await InvitesApi.revoke(id);
    load();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/join?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Liens d'invitation</h1>
        <button onClick={generate} className="btn bg-accent hover:bg-blue-500 text-white">
          + Générer un lien
        </button>
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Partagez un lien — la personne crée son compte et rejoint automatiquement votre restaurant. Valide 7 jours.
      </p>

      {loading ? (
        <p className="text-gray-400">Chargement...</p>
      ) : invites.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">Aucun lien actif.</div>
      ) : (
        <ul className="space-y-3">
          {invites.map((inv) => {
            const url = `${window.location.origin}/join?token=${inv.token}`;
            return (
              <li key={inv.id} className="card p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-500 truncate flex-1">{url}</p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => copyLink(inv.token)}
                      className="btn btn-secondary text-sm px-3"
                    >
                      {copied === inv.token ? '✓ Copié' : 'Copier'}
                    </button>
                    <button
                      onClick={() => revoke(inv.id)}
                      className="btn text-sm px-3 text-red-400 hover:text-red-300 border border-gray-700"
                    >
                      Révoquer
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-600">
                  Expire le {new Date(inv.expiresAt).toLocaleDateString('fr-CA')}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
