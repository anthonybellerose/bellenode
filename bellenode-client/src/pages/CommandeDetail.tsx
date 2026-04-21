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

  useEffect(() => {
    if (!id) return;
    CommandesApi.get(Number(id))
      .then(setCommande)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement...</div>;
  if (!commande) return <div className="p-8 text-center text-gray-400">Commande introuvable.</div>;

  const cfg = commande.config;
  const totalBtls = commande.items.reduce((s, i) => s + i.quantite, 0);
  const dateStr = new Date(commande.createdAt).toLocaleDateString('fr-CA', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="space-y-4">
      {/* Toolbar — masqué à l'impression */}
      <div className="flex items-center gap-3 print:hidden">
        <button className="btn btn-ghost" onClick={() => navigate('/commandes')}>← Retour</button>
        <span className="text-gray-400 text-sm flex-1">Commande #{commande.id} · {dateStr}</span>
        <button className="btn btn-ghost" onClick={() => window.print()}>🖨 Imprimer</button>
        <button className="btn btn-primary" onClick={() => CommandesApi.exportSaq(commande.id, `commande-saq-${commande.id}.xlsx`)}> Excel SAQ</button>
      </div>

      {/* Feuille de commande */}
      <div id="commande-print" className="bg-white text-gray-900 rounded-lg p-6 md:p-10 space-y-6 print:rounded-none print:p-8 print:shadow-none">

        {/* En-tête */}
        <div className="border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-center uppercase tracking-wide mb-4">
            Commande SAQ
          </h1>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <InfoLine label="Établissement" value={cfg.nomEtablissement} />
            <InfoLine label="Numéro de client" value={cfg.numeroClient} />
            <InfoLine label="Téléphone" value={cfg.telephone} />
            <InfoLine label="Courriel" value={cfg.courriel} />
            <InfoLine label="Responsable" value={cfg.responsable ?? commande.createdBy} />
            <InfoLine label="Date" value={dateStr} />
            <InfoLine label="Total bouteilles" value={String(totalBtls)} bold />
          </div>
        </div>

        {/* Tableau des items */}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="text-left py-2 pr-4 font-semibold w-28">Code SAQ</th>
              <th className="text-left py-2 pr-4 font-semibold">Nom du produit</th>
              <th className="text-left py-2 pr-4 font-semibold w-20">Volume</th>
              <th className="text-right py-2 font-semibold w-24">Qté cmdée</th>
            </tr>
          </thead>
          <tbody>
            {commande.items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="py-2 pr-4 font-mono text-gray-600">{item.codeSaq}</td>
                <td className="py-2 pr-4">{item.nomProduit.replace(/\s*-\s*\d.*$/, '')}</td>
                <td className="py-2 pr-4 text-gray-500">{item.volume ?? '—'}</td>
                <td className="py-2 text-right font-bold">{item.quantite}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-800">
              <td colSpan={3} className="py-2 pr-4 font-semibold text-right">Total bouteilles commandées :</td>
              <td className="py-2 text-right font-bold text-lg">{totalBtls}</td>
            </tr>
          </tfoot>
        </table>

        {commande.note && (
          <div className="text-sm text-gray-600 border-t pt-4">
            <span className="font-semibold">Note :</span> {commande.note}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoLine({ label, value, bold }: { label: string; value?: string | null; bold?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 min-w-36">{label} :</span>
      <span className={bold ? 'font-bold' : 'font-medium'}>{value || '—'}</span>
    </div>
  );
}
