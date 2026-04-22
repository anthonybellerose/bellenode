import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CommandesApi } from '../api/client';
import type { CommandeDetail } from '../types';
import { useAuth } from '../context/AuthContext';

export default function CommandeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRestaurantAdmin } = useAuth();
  const [commande, setCommande] = useState<CommandeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiveMode, setReceiveMode] = useState(false);
  const [recInputs, setRecInputs] = useState<Record<number, { qty: string; bo: boolean }>>({});
  const [submittingRec, setSubmittingRec] = useState(false);
  const [recMsg, setRecMsg] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const c = await CommandesApi.get(Number(id));
      setCommande(c);
      const defaults: Record<number, { qty: string; bo: boolean }> = {};
      for (const it of c.items) {
        const restant = Math.max(0, it.quantite - it.quantiteRecue);
        defaults[it.id] = { qty: it.isBackorder ? '0' : String(restant), bo: it.isBackorder };
      }
      setRecInputs(defaults);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement...</div>;
  if (!commande) return <div className="p-8 text-center text-gray-400">Commande introuvable.</div>;

  const cfg = commande.config;
  const totalBtls = commande.items.reduce((s, i) => s + i.quantite, 0);
  const totalRecues = commande.items.reduce((s, i) => s + i.quantiteRecue, 0);
  const complete = commande.items.every(i => i.isBackorder || i.quantiteRecue >= i.quantite);
  const totalEstime = commande.items.reduce(
    (s, i) => s + (i.prixUnitaire ?? 0) * i.quantite, 0
  );
  const hasAnyPrix = commande.items.some(i => i.prixUnitaire != null);
  const fmt$ = (n: number) => n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
  const dateStr = new Date(commande.createdAt).toLocaleDateString('fr-CA', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  async function submitReceive() {
    if (!commande) return;
    const items = commande.items.map(it => {
      const inp = recInputs[it.id];
      const q = parseInt(inp?.qty ?? '0');
      return { itemId: it.id, qtyReceived: isNaN(q) ? 0 : Math.max(0, q), markBackorder: !!inp?.bo };
    }).filter(x => x.qtyReceived > 0 || commande.items.find(i => i.id === x.itemId)!.isBackorder !== x.markBackorder);

    if (items.length === 0) {
      setRecMsg('Rien à enregistrer.');
      return;
    }
    setSubmittingRec(true); setRecMsg(null);
    try {
      const res = await CommandesApi.receive(commande.id, items);
      setRecMsg(`✅ Réception enregistrée (${res.totalReceived} bouteille${res.totalReceived > 1 ? 's' : ''} ajoutées à l'inventaire).`);
      setReceiveMode(false);
      await load();
    } catch (e: any) {
      setRecMsg(e?.response?.data?.error ?? 'Erreur lors de la réception.');
    } finally { setSubmittingRec(false); }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — masqué à l'impression */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button className="btn btn-ghost" onClick={() => navigate('/commandes')}>← Retour</button>
        <span className="text-gray-400 text-sm flex-1">
          Commande #{commande.id} · {dateStr}
          {complete
            ? <span className="badge badge-green ml-2">Complète</span>
            : totalRecues > 0
              ? <span className="badge badge-yellow ml-2">Partielle ({totalRecues}/{totalBtls})</span>
              : <span className="badge badge-gray ml-2">En attente</span>}
        </span>
        {isRestaurantAdmin && !receiveMode && !complete && (
          <button className="btn btn-primary" onClick={() => setReceiveMode(true)}>📦 Recevoir</button>
        )}
        {!receiveMode && <button className="btn btn-ghost" onClick={() => window.print()}>🖨 Imprimer</button>}
        {!receiveMode && (
          <button className="btn btn-primary" onClick={() => CommandesApi.exportSaq(commande.id, `commande-saq-${commande.id}.xlsx`)}> Excel SAQ</button>
        )}
      </div>

      {recMsg && !receiveMode && (
        <div className="card p-3 text-sm text-gray-100 border-accent/50">{recMsg}</div>
      )}

      {/* Mode réception */}
      {receiveMode && (
        <section className="card p-4 space-y-3 border-accent">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-gray-100">Réception de la commande</h3>
            <div className="flex gap-2">
              <button className="btn btn-ghost text-sm" onClick={() => setReceiveMode(false)}>Annuler</button>
              <button className="btn btn-primary text-sm" disabled={submittingRec} onClick={submitReceive}>
                {submittingRec ? '…' : 'Confirmer'}
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            Pour chaque produit, entre la quantité reçue. Coche <em>backorder</em> si l'article ne viendra pas.
            Les quantités reçues seront ajoutées à l'inventaire.
          </p>
          <ul className="divide-y divide-bg-border">
            {commande.items.map(it => {
              const restant = Math.max(0, it.quantite - it.quantiteRecue);
              const inp = recInputs[it.id] ?? { qty: '0', bo: false };
              return (
                <li key={it.id} className="py-2 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{it.nomProduit.replace(/\s*-\s*\d.*$/, '')}</div>
                    <div className="text-xs text-gray-500">
                      {it.codeSaq} · Commandé {it.quantite}
                      {it.quantiteRecue > 0 && ` · Déjà reçu ${it.quantiteRecue}`}
                      {restant > 0 && !it.isBackorder && ` · Restant ${restant}`}
                      {it.isBackorder && <span className="text-red-400"> · Backorder</span>}
                    </div>
                  </div>
                  <input
                    type="number" inputMode="numeric" min={0} max={restant}
                    value={inp.qty}
                    onChange={e => setRecInputs(r => ({ ...r, [it.id]: { ...inp, qty: e.target.value } }))}
                    className="w-20 text-right"
                    disabled={inp.bo}
                  />
                  <label className="flex items-center gap-1 text-xs text-gray-400 select-none">
                    <input
                      type="checkbox"
                      checked={inp.bo}
                      onChange={e => setRecInputs(r => ({ ...r, [it.id]: { ...inp, bo: e.target.checked, qty: e.target.checked ? '0' : inp.qty } }))}
                    />
                    BO
                  </label>
                </li>
              );
            })}
          </ul>
          {recMsg && <div className="text-sm text-red-400">{recMsg}</div>}
        </section>
      )}

      {/* Feuille de commande */}
      <div id="commande-print" className="card md:bg-white md:text-gray-900 p-4 md:p-10 space-y-6 print:rounded-none print:p-8 print:shadow-none print:bg-white print:text-gray-900">

        {/* En-tête */}
        <div className="border-b-2 border-bg-border md:border-gray-800 pb-4">
          <h1 className="text-xl md:text-2xl font-bold text-center uppercase tracking-wide mb-4 text-gray-100 md:text-gray-900 print:text-gray-900">
            Commande SAQ
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            <InfoLine label="Établissement" value={cfg.nomEtablissement} />
            <InfoLine label="Numéro de client" value={cfg.numeroClient} />
            <InfoLine label="Téléphone" value={cfg.telephone} />
            <InfoLine label="Courriel" value={cfg.courriel} />
            <InfoLine label="Responsable" value={cfg.responsable ?? commande.createdBy} />
            <InfoLine label="Date" value={dateStr} />
            <InfoLine label="Total bouteilles" value={String(totalBtls)} bold />
            {hasAnyPrix && (
              <InfoLine label="Total estimé" value={fmt$(totalEstime)} bold />
            )}
          </div>
        </div>

        {/* Mobile : cards */}
        <ul className="md:hidden divide-y divide-bg-border">
          {commande.items.map(item => {
            const itemComplete = item.isBackorder || item.quantiteRecue >= item.quantite;
            return (
              <li key={item.id} className="py-3 space-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-gray-100 flex-1">
                    {item.nomProduit.replace(/\s*-\s*\d.*$/, '')}
                  </span>
                  <span className="text-base font-bold text-gray-100 shrink-0">{item.quantite}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="font-mono">{item.codeSaq}</span>
                  {item.volume && <span>{item.volume}</span>}
                  {hasAnyPrix && item.prixUnitaire != null && <span>{fmt$(item.prixUnitaire)} / u</span>}
                  <span className={`ml-auto font-medium ${itemComplete ? 'text-green-400' : item.quantiteRecue > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {item.isBackorder ? 'Backorder' : `Reçu ${item.quantiteRecue}/${item.quantite}`}
                  </span>
                </div>
              </li>
            );
          })}
          <li className="py-3 flex items-center justify-between text-sm font-semibold text-gray-100">
            <span>Total bouteilles</span>
            <span>{totalBtls}</span>
          </li>
          {hasAnyPrix && (
            <li className="py-2 flex items-center justify-between text-sm font-semibold text-gray-100">
              <span>Total estimé</span>
              <span>{fmt$(totalEstime)}</span>
            </li>
          )}
        </ul>

        {/* Desktop : tableau */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="text-left py-2 pr-4 font-semibold w-28">Code SAQ</th>
                <th className="text-left py-2 pr-4 font-semibold">Nom du produit</th>
                <th className="text-left py-2 pr-4 font-semibold w-20">Volume</th>
                <th className="text-right py-2 pr-4 font-semibold w-20">Qté</th>
                <th className="text-right py-2 pr-4 font-semibold w-20 print:hidden">Reçu</th>
                {hasAnyPrix && (
                  <>
                    <th className="text-right py-2 pr-4 font-semibold w-24">Prix unit.</th>
                    <th className="text-right py-2 font-semibold w-28">Sous-total</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {commande.items.map((item, i) => {
                const sousTotal = (item.prixUnitaire ?? 0) * item.quantite;
                const itemComplete = item.isBackorder || item.quantiteRecue >= item.quantite;
                return (
                  <tr key={item.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-2 pr-4 font-mono text-gray-600">{item.codeSaq}</td>
                    <td className="py-2 pr-4">
                      {item.nomProduit.replace(/\s*-\s*\d.*$/, '')}
                      {item.isBackorder && <span className="ml-2 text-xs text-red-600 font-semibold print:hidden">(Backorder)</span>}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">{item.volume ?? '—'}</td>
                    <td className="py-2 pr-4 text-right font-bold">{item.quantite}</td>
                    <td className="py-2 pr-4 text-right print:hidden">
                      <span className={itemComplete ? 'text-green-700 font-semibold' : item.quantiteRecue > 0 ? 'text-yellow-700' : 'text-gray-400'}>
                        {item.isBackorder ? 'BO' : `${item.quantiteRecue}/${item.quantite}`}
                      </span>
                    </td>
                    {hasAnyPrix && (
                      <>
                        <td className="py-2 pr-4 text-right text-gray-600">
                          {item.prixUnitaire != null ? fmt$(item.prixUnitaire) : '—'}
                        </td>
                        <td className="py-2 text-right font-medium">
                          {item.prixUnitaire != null ? fmt$(sousTotal) : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-800">
                <td colSpan={3} className="py-2 pr-4 font-semibold text-right">Total bouteilles :</td>
                <td className="py-2 pr-4 text-right font-bold text-lg">{totalBtls}</td>
                <td className="py-2 pr-4 text-right text-sm print:hidden">
                  <span className={complete ? 'text-green-700' : 'text-yellow-700'}>{totalRecues}/{totalBtls}</span>
                </td>
                {hasAnyPrix && (
                  <>
                    <td className="py-2 pr-4 text-right font-semibold">Total estimé :</td>
                    <td className="py-2 text-right font-bold text-lg">{fmt$(totalEstime)}</td>
                  </>
                )}
              </tr>
              {hasAnyPrix && (
                <tr>
                  <td colSpan={7} className="pt-2 text-xs text-gray-500 italic">
                    * Prix estimé basé sur le prix de base du produit. Peut varier selon le prix SAQ réel.
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {commande.note && (
          <div className="text-sm border-t border-bg-border md:border-gray-200 pt-4 text-gray-400 md:text-gray-600 print:text-gray-600">
            <span className="font-semibold text-gray-100 md:text-gray-900 print:text-gray-900">Note :</span> {commande.note}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoLine({ label, value, bold }: { label: string; value?: string | null; bold?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 md:text-gray-500 print:text-gray-500 min-w-32">{label} :</span>
      <span className={`text-gray-100 md:text-gray-900 print:text-gray-900 ${bold ? 'font-bold' : 'font-medium'}`}>{value || '—'}</span>
    </div>
  );
}
