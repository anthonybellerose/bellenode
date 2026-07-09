import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommandesApi, InventoryApi, ProductsApi } from '../api/client';
import type { CommandeConfig, CommandeSummary, ObjectifRow, Product } from '../types';
import { useAuth } from '../context/AuthContext';

type DraftItem = { codeSaq: string; nomProduit: string; volume?: string | null; quantite: number; lotEffectif: number };

function formatQte(quantite: number, lot: number): string {
  if (lot > 1 && quantite % lot === 0) return `${quantite / lot}cs`;
  return `${quantite}x`;
}

function extractVolume(nom: string): string | null {
  const m = nom.match(/\b(\d+(?:[.,]\d+)?\s*(?:ml|mL|L|cl))\b/);
  return m ? m[1] : null;
}

export default function Commandes() {
  const { isRestaurantAdmin } = useAuth();
  const navigate = useNavigate();
  const [commandes, setCommandes] = useState<CommandeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<CommandeConfig>({});
  const [configForm, setConfigForm] = useState<CommandeConfig>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [objectifs, setObjectifs] = useState<ObjectifRow[]>([]);
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [addSearch, setAddSearch] = useState('');
  const [addResults, setAddResults] = useState<Product[]>([]);
  const addSearchRef = useRef<HTMLInputElement>(null);
  const [draftStrs, setDraftStrs] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const [list, cfg] = await Promise.all([CommandesApi.list(), CommandesApi.getConfig()]);
      setCommandes(list);
      setConfig(cfg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (addSearch.trim().length < 2) { setAddResults([]); return; }
    const t = setTimeout(async () => {
      const products = await ProductsApi.list(addSearch);
      setAddResults(products.filter(p => !!p.codeSaq));
    }, 200);
    return () => clearTimeout(t);
  }, [addSearch]);

  async function openCreate() {
    const rows = await InventoryApi.objectifs();
    const toOrder = rows.filter(r => r.aCommander && r.aCommander > 0 && r.codeSaq);
    setDraft(toOrder.map(r => ({
      codeSaq: r.codeSaq!,
      nomProduit: r.nom,
      volume: extractVolume(r.nom),
      quantite: r.aCommander!,
      lotEffectif: r.lotEffectif,
    })));
    setNote('');
    setAddSearch('');
    setAddResults([]);
    setCreating(true);
  }

  function addProductToDraft(p: Product) {
    const lot = p.lotQty ?? 1;
    const existing = draft.findIndex(d => d.codeSaq === p.codeSaq);
    if (existing >= 0) {
      setDraft(d => d.map((item, i) => i === existing ? { ...item, quantite: item.quantite + item.lotEffectif } : item));
    } else {
      setDraft(d => [...d, {
        codeSaq: p.codeSaq!,
        nomProduit: p.nom,
        volume: extractVolume(p.nom),
        quantite: lot,
        lotEffectif: lot,
      }]);
    }
    setAddSearch('');
    setAddResults([]);
    addSearchRef.current?.focus();
  }

  function setQtyStr(i: number, val: string) {
    const codeSaq = draft[i]?.codeSaq;
    if (!codeSaq) return;
    setDraftStrs(d => ({ ...d, [codeSaq]: val }));
    const q = parseInt(val);
    if (!isNaN(q) && q >= 0)
      setDraft(d => d.map((item, idx) => idx === i ? { ...item, quantite: q } : item));
  }

  function commitQtyStr(i: number) {
    const codeSaq = draft[i]?.codeSaq;
    if (!codeSaq || !(codeSaq in draftStrs)) return;
    const q = parseInt(draftStrs[codeSaq]);
    const final = isNaN(q) || q < 0 ? 0 : q;
    setDraft(d => d.map((item, idx) => idx === i ? { ...item, quantite: final } : item));
    setDraftStrs(d => { const n = { ...d }; delete n[codeSaq]; return n; });
  }

  const totalDraftCs = draft.filter(i => i.quantite > 0).reduce((s, i) => {
    return s + (i.lotEffectif > 1 && i.quantite % i.lotEffectif === 0 ? i.quantite / i.lotEffectif : 0);
  }, 0);

  function removeItem(i: number) {
    setDraft(d => d.filter((_, idx) => idx !== i));
  }

  async function saveCommande() {
    const items = draft.filter(i => i.quantite > 0);
    if (items.length === 0) return;
    setSaving(true);
    try {
      const res = await CommandesApi.create({ note: note || undefined, items });
      setCreating(false);
      navigate(`/commandes/${res.id}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveConfig() {
    setSavingConfig(true);
    try {
      await CommandesApi.updateConfig(configForm);
      setConfig(configForm);
      setConfigOpen(false);
    } finally {
      setSavingConfig(false);
    }
  }

  function openConfig() {
    setConfigForm({ ...config });
    setConfigOpen(true);
  }

  async function confirmDelete() {
    if (deleteId === null) return;
    await CommandesApi.remove(deleteId);
    setDeleteId(null);
    load();
  }

  const totalDraft = draft.reduce((s, i) => s + i.quantite, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <header className="flex items-center justify-between">
        <div className="hidden md:block">
          <h2 className="page-title">Commandes SAQ</h2>
          <p className="page-subtitle">{commandes.length} commande{commandes.length !== 1 ? 's' : ''} enregistrée{commandes.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {isRestaurantAdmin && (
            <button className="btn btn-ghost" onClick={openConfig}>⚙ Config</button>
          )}
          <button className="btn btn-primary flex-1 md:flex-none" onClick={openCreate}>+ Nouvelle commande</button>
        </div>
      </header>

      <section className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : commandes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Aucune commande. Créez-en une depuis vos objectifs.</div>
        ) : (
          <>
            <ul className="md:hidden divide-y divide-bg-border">
              {commandes.map(c => (
                <li key={c.id} className="p-3 active:bg-bg-elevated cursor-pointer"
                  onClick={() => navigate(`/commandes/${c.id}`)}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm text-gray-100 font-medium">
                        Commande #{c.id}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(c.createdAt).toLocaleDateString('fr-CA', { year:'numeric', month:'short', day:'numeric' })}
                        {c.createdBy && ` · ${c.createdBy}`}
                      </div>
                      {c.note && <div className="text-xs text-gray-400 mt-0.5 italic">{c.note}</div>}
                      {c.emailEnvoyeA && (
                        <div className="text-xs text-green-500 mt-0.5">✉ Envoyé · {c.emailEnvoyeA}</div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 flex items-start gap-2">
                      <div>
                        <div className="text-base font-bold text-accent">{c.totalBtls} btls</div>
                        <div className="text-[10px] text-gray-500">{c.nbItems} produit{c.nbItems !== 1 ? 's' : ''}</div>
                      </div>
                      {isRestaurantAdmin && (
                        <button
                          type="button"
                          aria-label="Supprimer"
                          onClick={e => { e.stopPropagation(); setDeleteId(c.id); }}
                          className="w-9 h-9 -mt-1 -mr-1 flex items-center justify-center text-gray-500 active:text-red-400 text-xl"
                        >×</button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <table className="table-default">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Créé par</th>
                    <th>Note</th>
                    <th className="text-right">Produits</th>
                    <th className="text-right">Total btls</th>
                    <th>Courriel</th>
                    {isRestaurantAdmin && <th className="w-16"></th>}
                  </tr>
                </thead>
                <tbody>
                  {commandes.map(c => (
                    <tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/commandes/${c.id}`)}>
                      <td className="font-mono text-gray-400">#{c.id}</td>
                      <td>{new Date(c.createdAt).toLocaleDateString('fr-CA', { year:'numeric', month:'short', day:'numeric' })}</td>
                      <td>{c.createdBy ?? '-'}</td>
                      <td className="text-gray-400 italic">{c.note ?? '-'}</td>
                      <td className="text-right">{c.nbItems}</td>
                      <td className="text-right font-bold text-accent">{c.totalBtls}</td>
                      <td>
                        {c.emailEnvoyeA
                          ? <span className="text-xs text-green-500">✉ {c.emailEnvoyeA}<br/><span className="text-gray-500">{new Date(c.emailEnvoyeLe!).toLocaleDateString('fr-CA', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span></span>
                          : <span className="text-xs text-gray-600">—</span>}
                      </td>
                      {isRestaurantAdmin && (
                        <td>
                          <button className="text-red-400 hover:text-red-300 text-xs"
                            onClick={e => { e.stopPropagation(); setDeleteId(c.id); }}>
                            Suppr.
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Modal création */}
      {creating && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="card w-full max-w-2xl my-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Nouvelle commande SAQ</h3>
                <p className="text-xs text-gray-400">Basée sur vos objectifs · {draft.filter(i=>i.quantite>0).length} produit(s) · {totalDraft} btls</p>
              </div>
              <button className="text-gray-400 hover:text-white text-xl" onClick={() => setCreating(false)}>✕</button>
            </div>

            {draft.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Aucun produit à commander (définissez des objectifs min/max d'abord).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-default text-sm">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Code SAQ</th>
                      <th>Volume</th>
                      <th className="text-right w-24">Qté</th>
                      <th className="text-right w-16">SAQ</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.map((item, i) => (
                      <tr key={i}>
                        <td className="text-gray-100">{item.nomProduit.replace(/\s*-\s*\d.*$/, '')}</td>
                        <td className="font-mono text-gray-400 text-xs">{item.codeSaq}</td>
                        <td className="text-gray-400 text-xs">{item.volume ?? '-'}</td>
                        <td>
                          <input type="number" inputMode="numeric" min={0}
                            value={draftStrs[item.codeSaq] ?? item.quantite.toString()}
                            onChange={e => setQtyStr(i, e.target.value)}
                            onBlur={() => commitQtyStr(i)}
                            className="w-20 text-center font-bold ml-auto block" />
                        </td>
                        <td className="text-right font-bold text-accent text-sm">
                          {formatQte(item.quantite, item.lotEffectif)}
                        </td>
                        <td>
                          <button className="text-red-400 hover:text-red-300 text-xs px-1"
                            onClick={() => removeItem(i)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="relative">
              <label className="block text-xs text-gray-400 mb-1">Ajouter un produit manuellement</label>
              <input
                ref={addSearchRef}
                type="text"
                value={addSearch}
                onChange={e => setAddSearch(e.target.value)}
                onBlur={() => setTimeout(() => setAddResults([]), 150)}
                placeholder="Rechercher par nom ou code SAQ..."
                className="w-full"
              />
              {addResults.length > 0 && (
                <ul className="absolute z-20 w-full bg-bg-elevated border border-bg-border rounded-md mt-1 max-h-52 overflow-y-auto shadow-lg">
                  {addResults.map(p => (
                    <li key={p.id}
                      onMouseDown={() => addProductToDraft(p)}
                      className="px-3 py-2 hover:bg-bg-border cursor-pointer">
                      <div className="text-sm text-gray-100 truncate">{p.nom}</div>
                      <div className="text-xs text-gray-500 font-mono">{p.codeSaq}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Note (optionnel)</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                placeholder="Ex: Commande semaine du 21 avril" className="w-full" />
            </div>

            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setCreating(false)}>Annuler</button>
              <button className="btn btn-primary flex-1" onClick={saveCommande}
                disabled={saving || draft.filter(i=>i.quantite>0).length === 0}>
                {saving ? 'Enregistrement...' : `Créer la commande (${totalDraft} btls)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal config */}
      {configOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md space-y-4 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Configuration commande</h3>
              <button className="text-gray-400 hover:text-white" onClick={() => setConfigOpen(false)}>✕</button>
            </div>
            <p className="text-xs text-gray-400">Ces informations apparaissent dans l'en-tête de chaque commande.</p>
            {([
              ['nomEtablissement', "Nom de l'établissement"],
              ['numeroClient', 'Numéro de client SAQ'],
              ['telephone', 'Numéro de téléphone'],
              ['courriel', 'Courriel'],
              ['responsable', 'Responsable de commande'],
            ] as [keyof CommandeConfig, string][]).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input type="text" value={configForm[field] ?? ''}
                  onChange={e => setConfigForm(f => ({ ...f, [field]: e.target.value || null }))}
                  className="w-full" />
              </div>
            ))}
            <hr className="border-bg-border" />
            <p className="text-xs text-gray-400 font-semibold">Envoi par courriel</p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Destinataire (courriel de la SAQ)</label>
              <input type="email" value={configForm.emailDestinataire ?? ''}
                onChange={e => setConfigForm(f => ({ ...f, emailDestinataire: e.target.value || null }))}
                placeholder="commandes@saq.com" className="w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Objet du courriel</label>
              <input type="text" value={configForm.emailSujet ?? ''}
                onChange={e => setConfigForm(f => ({ ...f, emailSujet: e.target.value || null }))}
                placeholder="Commande SAQ - Le Pub 111" className="w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Message (optionnel)</label>
              <textarea rows={3} value={configForm.emailMessage ?? ''}
                onChange={e => setConfigForm(f => ({ ...f, emailMessage: e.target.value || null }))}
                placeholder="Bonjour, veuillez trouver notre commande en pièce jointe."
                className="w-full resize-none" />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setConfigOpen(false)}>Annuler</button>
              <button className="btn btn-primary flex-1" onClick={saveConfig} disabled={savingConfig}>
                {savingConfig ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm space-y-4 text-center">
            <p className="text-gray-100">Supprimer la commande #{deleteId} ?</p>
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setDeleteId(null)}>Annuler</button>
              <button className="btn bg-red-700 hover:bg-red-600 text-white flex-1" onClick={confirmDelete}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
