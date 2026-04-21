import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommandesApi } from '../api/client';
import type { PendingCommandeItem } from '../types';
import { useAuth } from '../context/AuthContext';

export default function NonRecus() {
  const { isRestaurantAdmin } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<PendingCommandeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setRows(await CommandesApi.pendingItems()); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function markBackorder(itemId: number) {
    setBusyItem(itemId); setMsg(null);
    try {
      await CommandesApi.toggleBackorder(itemId, true);
      setMsg('✅ Marqué en backorder.');
      await load();
    } catch {
      setMsg('Erreur.');
    } finally { setBusyItem(null); }
  }

  async function receiveAll(item: PendingCommandeItem) {
    setBusyItem(item.id); setMsg(null);
    try {
      await CommandesApi.receive(item.commandeId, [{
        itemId: item.id, qtyReceived: item.qtyManquante, markBackorder: false
      }]);
      setMsg(`✅ ${item.qtyManquante} bouteilles ajoutées à l'inventaire.`);
      await load();
    } catch {
      setMsg('Erreur.');
    } finally { setBusyItem(null); }
  }

  const totalManquant = rows.reduce((s, r) => s + r.qtyManquante, 0);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Non reçus</h2>
          <p className="page-subtitle">
            {rows.length} item{rows.length !== 1 ? 's' : ''} en attente
            {totalManquant > 0 && ` · ${totalManquant} bouteille${totalManquant > 1 ? 's' : ''} manquante${totalManquant > 1 ? 's' : ''}`}
          </p>
        </div>
      </header>

      {msg && <div className="card p-3 text-sm text-gray-100 border-accent/50">{msg}</div>}

      {loading ? (
        <div className="p-8 text-center text-gray-400">Chargement...</div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 text-sm">
          ✅ Toutes les commandes ont été reçues.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map(r => (
            <li key={r.id} className="card p-3 md:p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-white font-medium">
                    {r.nomProduit.replace(/\s*-\s*\d.*$/, '')}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{r.codeSaq}</span>
                    {r.volume && <span>{r.volume}</span>}
                    <button
                      className="text-accent hover:underline"
                      onClick={() => navigate(`/commandes/${r.commandeId}`)}
                    >
                      Commande #{r.commandeId}
                    </button>
                    <span>{new Date(r.commandeDate).toLocaleDateString('fr-CA')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-sm">
                    <span className="text-gray-400">Reçu </span>
                    <span className="text-white font-bold">{r.quantiteRecue}</span>
                    <span className="text-gray-400"> / {r.quantite}</span>
                  </div>
                  <span className="badge badge-yellow">Manque {r.qtyManquante}</span>
                  {isRestaurantAdmin && (
                    <div className="flex gap-2">
                      <button
                        className="btn btn-primary text-sm"
                        disabled={busyItem === r.id}
                        onClick={() => receiveAll(r)}
                      >
                        Tout recevoir
                      </button>
                      <button
                        className="btn btn-ghost text-sm"
                        disabled={busyItem === r.id}
                        onClick={() => markBackorder(r.id)}
                      >
                        Backorder
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
