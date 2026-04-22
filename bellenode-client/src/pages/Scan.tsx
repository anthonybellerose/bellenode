import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductsApi, ScanApi, CommandesApi } from '../api/client';
import type { Product, RawOp, ScanModeString, PendingCommandeItem } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';

interface ScanLine extends RawOp {
  nom?: string | null;
  unknown?: boolean;
  tempId: number;
  pendingMatch?: { commandeId: number; itemId: number; commandeDate: string; restant: number } | null;
}

export default function Scan() {
  const [mode, setMode] = useState<ScanModeString>('+');
  const [codeInput, setCodeInput] = useState('');
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [note, setNote] = useState('');
  const [user, setUser] = useState(() => localStorage.getItem('bellenode.user') ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported] = useState(() => typeof window !== 'undefined' && 'BarcodeDetector' in window);
  const [pendingBySaq, setPendingBySaq] = useState<Record<string, PendingCommandeItem[]>>({});
  const [receiving, setReceiving] = useState(false);
  const [showNameSearch, setShowNameSearch] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [nameResults, setNameResults] = useState<Product[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameSearchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function reloadPending() {
    try {
      const items = await CommandesApi.pendingItems();
      const map: Record<string, PendingCommandeItem[]> = {};
      for (const it of items) {
        if (!map[it.codeSaq]) map[it.codeSaq] = [];
        map[it.codeSaq].push(it);
      }
      // Ordonne par plus vieille commande en premier (FIFO)
      for (const k of Object.keys(map)) {
        map[k].sort((a, b) => a.commandeDate.localeCompare(b.commandeDate));
      }
      setPendingBySaq(map);
    } catch { /* ignore — si pas de resto sélectionné par ex */ }
  }

  useEffect(() => { reloadPending(); }, []);

  useEffect(() => {
    localStorage.setItem('bellenode.user', user);
  }, [user]);

  useEffect(() => {
    if (!nameSearch.trim()) { setNameResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const results = await ProductsApi.list(nameSearch.trim());
        setNameResults(results.slice(0, 8));
      } catch { setNameResults([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [nameSearch]);

  function addFromProduct(p: Product) {
    let pendingMatch: ScanLine['pendingMatch'] = null;
    if (mode === '+' && p.codeSaq && pendingBySaq[p.codeSaq]?.length) {
      const first = pendingBySaq[p.codeSaq][0];
      pendingMatch = { commandeId: first.commandeId, itemId: first.id, commandeDate: first.commandeDate, restant: first.qtyManquante };
    }
    setLines(prev => [
      { tempId: Date.now() + Math.random(), mode, code: p.codeUpc, quantite: 1, nom: p.nom, unknown: false, pendingMatch },
      ...prev,
    ]);
    setNameSearch('');
    setNameResults([]);
    nameSearchRef.current?.focus();
  }

  const addLine = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      const upper = trimmed.toUpperCase();
      if (upper === '+' || upper === 'A' || upper === 'ADD') {
        setMode('+');
        setCodeInput('');
        return;
      }
      if (upper === '-' || upper === 'R' || upper === 'REM' || upper === 'REMOVE') {
        setMode('-');
        setCodeInput('');
        return;
      }
      if (upper === '=' || upper === 'S' || upper === 'SET') {
        setMode('=');
        setCodeInput('');
        return;
      }

      let nom: string | null = null;
      let unknown = false;
      let pendingMatch: ScanLine['pendingMatch'] = null;
      try {
        const p = await ProductsApi.byUpc(trimmed);
        nom = p.nom;
        // Check if the product's codeSaq matches any pending commande item (only in mode +)
        if (mode === '+' && p.codeSaq && pendingBySaq[p.codeSaq]?.length) {
          const first = pendingBySaq[p.codeSaq][0];
          pendingMatch = {
            commandeId: first.commandeId,
            itemId: first.id,
            commandeDate: first.commandeDate,
            restant: first.qtyManquante,
          };
        }
      } catch {
        unknown = true;
      }

      setLines((prev) => [
        { tempId: Date.now() + Math.random(), mode, code: trimmed, quantite: 1, nom, unknown, pendingMatch },
        ...prev,
      ]);
      setCodeInput('');
    },
    [mode],
  );

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLine(codeInput);
    }
  }

  function removeLine(tempId: number) {
    setLines((prev) => prev.filter((l) => l.tempId !== tempId));
  }

  function updateQty(tempId: number, qty: number) {
    setLines((prev) => prev.map((l) => (l.tempId === tempId ? { ...l, quantite: qty } : l)));
  }

  async function importBulk() {
    try {
      const ops = await ScanApi.parseText(bulkText);
      if (ops.length === 0) {
        setMsg('Aucune ligne exploitable dans le texte.');
        return;
      }
      const mapped = await Promise.all(
        ops.map(async (op) => {
          let nom: string | null = null;
          let unknown = false;
          try {
            const p = await ProductsApi.byUpc(op.code);
            nom = p.nom;
          } catch {
            unknown = true;
          }
          return {
            tempId: Date.now() + Math.random(),
            mode: op.mode,
            code: op.code,
            quantite: op.quantite ?? 1,
            nom,
            unknown,
          } as ScanLine;
        }),
      );
      setLines((prev) => [...mapped, ...prev]);
      setBulkText('');
      setShowBulk(false);
      setMsg(`${mapped.length} ligne(s) importée(s).`);
    } catch (e) {
      console.error(e);
      setMsg('Erreur lors du parsing.');
    }
  }

  async function markReceptions() {
    const toReceive = lines.filter(l => l.pendingMatch);
    if (toReceive.length === 0) return;
    setReceiving(true); setMsg(null);
    try {
      // Regroupe par commandeId pour faire 1 POST par commande
      const byCmd: Record<number, { itemId: number; qtyReceived: number; markBackorder: boolean }[]> = {};
      for (const l of toReceive) {
        const pm = l.pendingMatch!;
        if (!byCmd[pm.commandeId]) byCmd[pm.commandeId] = [];
        // Regroupe plusieurs scans pour un même item
        const existing = byCmd[pm.commandeId].find(x => x.itemId === pm.itemId);
        if (existing) existing.qtyReceived += l.quantite ?? 1;
        else byCmd[pm.commandeId].push({ itemId: pm.itemId, qtyReceived: l.quantite ?? 1, markBackorder: false });
      }
      let totalReceived = 0;
      for (const [cmdId, its] of Object.entries(byCmd)) {
        const res = await CommandesApi.receive(Number(cmdId), its);
        totalReceived += res.totalReceived;
      }
      // Retire les lignes converties
      const toRemoveIds = new Set(toReceive.map(l => l.tempId));
      setLines(prev => prev.filter(l => !toRemoveIds.has(l.tempId)));
      await reloadPending();
      setMsg(`✅ ${totalReceived} bouteille(s) marquées reçues et ajoutées au stock.`);
    } catch (e) {
      console.error(e);
      setMsg('❌ Erreur lors de la réception.');
    } finally { setReceiving(false); }
  }

  async function submit() {
    if (lines.length === 0) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const result = await ScanApi.submitBatch(
        lines.map((l) => ({ mode: l.mode, code: l.code, quantite: l.quantite })),
        note || undefined,
        user || undefined,
      );
      setLines([]);
      setNote('');
      setMsg(
        `✅ Batch #${result.batchId} créé — ${result.produitsTouches} produits, +${result.totalAjouts} / -${result.totalRetraits}`,
      );
      setTimeout(() => navigate(`/batches/${result.batchId}`), 1500);
    } catch (e) {
      console.error(e);
      setMsg("❌ Erreur lors de l'envoi du batch.");
    } finally {
      setSubmitting(false);
    }
  }

  const modeButton = (m: ScanModeString, label: string, colorClass: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        inputRef.current?.focus();
      }}
      className={`flex-1 px-3 py-4 rounded-md text-base md:text-lg font-bold border transition-colors ${
        mode === m
          ? `${colorClass} text-white border-transparent shadow-lg`
          : 'bg-bg-elevated text-gray-400 border-bg-border active:bg-bg-border'
      }`}
      style={{ minHeight: 56 }}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {cameraOpen && (
        <BarcodeScanner
          mode={mode}
          onModeChange={setMode}
          onDetect={(code) => {
            addLine(code);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <header className="hidden md:block">
        <h2 className="page-title">Scan</h2>
        <p className="page-subtitle">
          Ajoute, retire ou fixe des quantités. Scanner USB/BT, caméra ou saisie manuelle.
        </p>
      </header>

      {msg && (
        <div className="card p-3 text-sm text-gray-200 border-accent/50">{msg}</div>
      )}

      {/* Mode + input sticky au top sur mobile */}
      <section className="card p-4 space-y-3 md:sticky md:top-0 md:z-10">
        <div className="flex gap-2">
          {modeButton('+', '+ Ajouter', 'bg-green-600')}
          {modeButton('-', '− Retirer', 'bg-red-600')}
          {modeButton('=', '= Fixer', 'bg-accent')}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowNameSearch(false); setTimeout(() => inputRef.current?.focus(), 50); }}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${!showNameSearch ? 'bg-accent text-white' : 'bg-bg-elevated text-gray-400 hover:text-white'}`}
          >
            Code
          </button>
          <button
            type="button"
            onClick={() => { setShowNameSearch(true); setTimeout(() => nameSearchRef.current?.focus(), 50); }}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${showNameSearch ? 'bg-accent text-white' : 'bg-bg-elevated text-gray-400 hover:text-white'}`}
          >
            Par nom
          </button>
        </div>

        {!showNameSearch ? (
        <div className="flex gap-2 items-stretch">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Scanne ou tape un code UPC..."
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={handleKey}
              className="w-full font-mono text-lg pr-12"
            />
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              aria-label="Scanner avec la caméra"
              className={`absolute right-0 top-0 h-full px-3 flex items-center justify-center text-xl transition-colors ${cameraSupported ? 'text-gray-400 hover:text-white' : 'text-gray-700 cursor-not-allowed'}`}
              disabled={!cameraSupported}
            >
              📷
            </button>
          </div>
          <button
            className="btn btn-primary hidden md:flex items-center justify-center text-2xl font-bold w-12 shrink-0"
            onClick={() => addLine(codeInput)}
          >
            +
          </button>
        </div>
        ) : (
        <div className="relative">
          <input
            ref={nameSearchRef}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Rechercher un produit par nom..."
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="w-full text-lg"
          />
          {nameResults.length > 0 && (
            <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-bg-elevated border border-bg-border rounded-md shadow-xl overflow-hidden">
              {nameResults.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); addFromProduct(p); }}
                    className="w-full text-left px-4 py-3 hover:bg-bg-border active:bg-bg-border flex items-center gap-3"
                    style={{ minHeight: 48 }}
                  >
                    <span className="flex-1 text-sm text-gray-100">{p.nom}</span>
                    <span className="text-xs text-gray-500 font-mono shrink-0">{p.codeUpc}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {nameSearch.trim() && nameResults.length === 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-bg-elevated border border-bg-border rounded-md px-4 py-3 text-sm text-gray-500">
              Aucun résultat pour « {nameSearch} »
            </div>
          )}
        </div>
        )}

        <div className="flex flex-wrap gap-2 justify-between items-center">
          <div className="text-xs text-gray-500 flex gap-3 flex-wrap">
            <span>Entrée = ajoute</span>
            <span className="hidden sm:inline">+/−/= = change mode</span>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-ghost text-xs px-3 py-1.5"
              style={{ minHeight: 36 }}
              onClick={() => setShowBulk((s) => !s)}
            >
              {showBulk ? 'Masquer texte' : 'Coller texte'}
            </button>
            <button
              className="btn btn-ghost text-xs px-3 py-1.5"
              style={{ minHeight: 36 }}
              onClick={() => {
                if (lines.length === 0) return;
                if (confirm('Effacer toutes les lignes?')) setLines([]);
              }}
            >
              Vider
            </button>
          </div>
        </div>

        {showBulk && (
          <div className="space-y-2 pt-2 border-t border-bg-border">
            <textarea
              rows={5}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full font-mono text-sm"
              placeholder={'+\n4901777035614\n080686821311\n-\n088004400361'}
            />
            <div className="flex flex-wrap gap-2 items-center">
              <button className="btn btn-secondary text-sm" onClick={importBulk}>
                Importer {bulkText.split('\n').filter((l) => l.trim()).length} ligne(s)
              </button>
              <label className="btn btn-ghost text-sm cursor-pointer">
                📂 Charger fichier…
                <input
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const text = await f.text();
                    setBulkText((prev) => (prev ? prev + '\n' + text : text));
                    e.target.value = '';
                  }}
                />
              </label>
              <span className="text-xs text-gray-500">
                Formats : lignes `+`/`-`/`=` pour changer mode, puis un code par ligne.
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Bandeau détection réception commande */}
      {(() => {
        const pendingLines = lines.filter(l => l.pendingMatch);
        if (pendingLines.length === 0) return null;
        const total = pendingLines.reduce((s, l) => s + (l.quantite ?? 1), 0);
        return (
          <section className="card p-3 border-accent/60 bg-accent/5 flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-100 flex-1">
              ⏳ <strong>{pendingLines.length}</strong> scan{pendingLines.length > 1 ? 's' : ''} correspond{pendingLines.length > 1 ? 'ent' : ''} à des commandes en attente ({total} bouteille{total > 1 ? 's' : ''})
            </span>
            <button
              className="btn btn-primary text-sm"
              disabled={receiving}
              onClick={markReceptions}
            >
              {receiving ? '…' : `📦 Marquer comme reçu${total > 1 ? 'es' : ''}`}
            </button>
          </section>
        );
      })()}

      {/* Liste des lignes — cards sur mobile, table sur desktop */}
      <section className="card">
        <div className="px-4 py-3 border-b border-bg-border flex items-center justify-between">
          <h3 className="font-semibold text-base">Lignes ({lines.length})</h3>
          {lines.length > 0 && (
            <div className="text-xs text-gray-400 flex gap-2">
              <span className="text-green-400">+{lines.filter((l) => l.mode === '+').length}</span>
              <span className="text-red-400">−{lines.filter((l) => l.mode === '-').length}</span>
              <span className="text-accent">={lines.filter((l) => l.mode === '=').length}</span>
            </div>
          )}
        </div>
        {lines.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Aucune ligne pour l'instant.</div>
        ) : (
          <>
            {/* Mobile: liste de cards */}
            <ul className="md:hidden divide-y divide-bg-border">
              {lines.map((l) => (
                <li key={l.tempId} className="p-3 flex items-start gap-3">
                  <span
                    className={`badge text-base px-2 py-1 ${
                      l.mode === '+' ? 'badge-green' : l.mode === '-' ? 'badge-red' : 'badge-blue'
                    }`}
                  >
                    {l.mode}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs text-gray-500 truncate">{l.code}</div>
                    <div className="text-sm text-gray-100 truncate">
                      {l.unknown ? (
                        <span className="badge badge-yellow">Non référencé</span>
                      ) : (
                        l.nom
                      )}
                    </div>
                    {l.pendingMatch && (
                      <div className="text-xs text-accent mt-0.5">
                        ⏳ Cmd #{l.pendingMatch.commandeId} (reste {l.pendingMatch.restant})
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={l.quantite}
                    onChange={(e) => updateQty(l.tempId, parseInt(e.target.value) || 1)}
                    className="w-16 text-right text-sm"
                    style={{ minHeight: 40 }}
                  />
                  <button
                    onClick={() => removeLine(l.tempId)}
                    aria-label="Supprimer"
                    className="w-10 h-10 flex items-center justify-center text-gray-500 active:text-red-400 text-xl"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block">
              <table className="table-default">
                <thead>
                  <tr>
                    <th className="w-16">Mode</th>
                    <th>Code</th>
                    <th>Produit</th>
                    <th className="w-24 text-right">Qté</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.tempId}>
                      <td>
                        <span
                          className={`badge ${
                            l.mode === '+' ? 'badge-green' : l.mode === '-' ? 'badge-red' : 'badge-blue'
                          }`}
                        >
                          {l.mode}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-gray-400">{l.code}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {l.unknown ? (
                            <span className="badge badge-yellow">Non référencé</span>
                          ) : (
                            <span className="text-gray-200">{l.nom}</span>
                          )}
                          {l.pendingMatch && (
                            <span className="text-xs text-accent">
                              ⏳ Cmd #{l.pendingMatch.commandeId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <input
                          type="number"
                          min={1}
                          value={l.quantite}
                          onChange={(e) => updateQty(l.tempId, parseInt(e.target.value) || 1)}
                          className="w-20 text-right"
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => removeLine(l.tempId)}
                          className="w-10 h-10 text-gray-500 hover:text-red-400 text-xl"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Utilisateur</label>
            <input
              type="text"
              placeholder="Ton nom"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Note</label>
            <input
              type="text"
              placeholder="Ex: livraison SAQ, inventaire..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <button
          className="btn btn-primary w-full text-base font-bold"
          style={{ minHeight: 56 }}
          onClick={submit}
          disabled={submitting || lines.length === 0}
        >
          {submitting ? 'Envoi...' : `Valider (${lines.length} ligne${lines.length > 1 ? 's' : ''})`}
        </button>
      </section>
    </div>
  );
}
