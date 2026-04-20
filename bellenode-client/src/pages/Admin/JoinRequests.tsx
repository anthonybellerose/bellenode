import { useEffect, useState } from 'react';
import { JoinRequestsApi } from '../../api/client';
import type { JoinRequest } from '../../types';

export default function JoinRequests() {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    JoinRequestsApi.list().then(setRequests).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handle = async (id: number, action: 'approve' | 'reject') => {
    if (action === 'approve') await JoinRequestsApi.approve(id);
    else await JoinRequestsApi.reject(id);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Demandes d'accès</h1>

      {loading ? (
        <p className="text-gray-400">Chargement...</p>
      ) : requests.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          Aucune demande en attente.
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-white font-medium">{r.user.nom}</p>
                  <p className="text-gray-400 text-sm">{r.user.email}</p>
                  <p className="text-gray-600 text-xs mt-0.5">
                    {new Date(r.createdAt).toLocaleDateString('fr-CA')}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handle(r.id, 'approve')}
                    className="btn bg-green-700 hover:bg-green-600 text-white text-sm px-4"
                  >
                    Accepter
                  </button>
                  <button
                    onClick={() => handle(r.id, 'reject')}
                    className="btn bg-red-800 hover:bg-red-700 text-white text-sm px-4"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
