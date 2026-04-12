import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductsApi, ScanApi } from '../api/client';
import type { RawOp, ScanModeString } from '../types';

interface ScanLine extends RawOp {
  nom?: string | null;
  unknown?: boolean;
  tempId: number;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    localStorage.setItem('bellenode.user', user);
  }, [user]);

  async function addLine(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;

    const upper = trimmed.toUpperCase();
    if (upper === '+' || upper === 'ADD') {
      setMode('+');
      setCodeInput('');
      return;
    }
    if (upper === '-' || upper === 'REM') {
      setMode('-');
      setCodeInput('');
      return;
    }
    if (upper === '=' || upper === 'SET') {
      setMode('=');
      setCodeInput('');
      return;
    }

    let nom: string | null = null;
    let unknown = false;
    try {
      const p = await ProductsApi.byUpc(trimmed);
      nom = p.nom;
    } catch {
      unknown = true;
    }

    setLines((prev) => [
      ...prev,
      { tempId: Date.now() + Math.random(), mode, code: trimmed, quantite: 1, nom, unknown },
    ]);
    setCodeInput('');
  }

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
      setLines((prev) => [...prev, ...mapped]);
      setBulkText('');
      setShowBulk(false);
      setMsg(`${mapped.length} ligne(s) importée(s).`);
    } catch (e) {
      console.error(e);
      setMsg('Erreur lors du parsing.');
    }
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
      setMsg('❌ Erreur lors de l\'envoi du batch.');
    } finally {
      setSubmitting(false);
    }
  }

  const modeButton = (m: ScanModeString, label: string, color: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        inputRef.current?.focus();
      }}
      className={`px-4 py-2 rounded-md font-semibold border transition-colors ${
        mode === m
          ? `${color} text-white border-transparent`
          : 'bg-bg-elevated text-gray-300 border-bg-border hover:bg-bg-border'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-white">Scan</h2>
        <p className="text-gray-400 mt-1">Ajoute, retire ou fixe des quantités. Utilise un lecteur USB ou tape les codes.</p>
      </header>

      {msg && (
        <div className="card p-3 text-sm border-accent/50 text-gray-200">{msg}</div>
      )}

      <section className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-400 mr-1">Mode:</span>
          {modeButton('+', '+ Ajouter', 'bg-green-600')}
          {modeButton('-', '− Retirer', 'bg-red-600')}
          {modeButton('=', '= Fixer', 'bg-accent')}
          <div className="ml-auto flex gap-2">
            <button className="btn btn-ghost text-sm" onClick={() => setShowBulk((s) => !s)}>
              {showBulk ? 'Masquer texte' : 'Coller texte'}
            </button>
            <button
              className="btn btn-ghost text-sm"
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
          <div className="space-y-2">
            <textarea
              rows={6}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full font-mono text-sm"
              placeholder={'+\n4901777035614\n080686821311\n-\n088004400361'}
            />
            <button className="btn btn-secondary text-sm" onClick={importBulk}>
              Importer {bulkText.split('\n').filter((l) => l.trim()).length} ligne(s)
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="Scanne ou tape un code UPC..."
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 font-mono text-lg"
          />
          <button className="btn btn-primary" onClick={() => addLine(codeInput)}>
            Ajouter
          </button>
        </div>

        <div className="flex gap-4 text-xs text-gray-500">
          <span>💡 Entrée = ajoute la ligne</span>
          <span>💡 Tape +, − ou = pour changer de mode</span>
          <span>💡 Une caisse est convertie automatiquement en bouteilles</span>
        </div>
      </section>

      <section className="card">
        <div className="px-5 py-3 border-b border-bg-border flex items-center justify-between">
          <h3 className="font-semibold">Lignes du batch ({lines.length})</h3>
          {lines.length > 0 && (
            <div className="text-sm text-gray-400">
              + {lines.filter((l) => l.mode === '+').length} · − {lines.filter((l) => l.mode === '-').length} · = {lines.filter((l) => l.mode === '=').length}
            </div>
          )}
        </div>
        {lines.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucune ligne pour l'instant.</div>
        ) : (
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
                    {l.unknown ? (
                      <span className="badge badge-yellow">Non référencé</span>
                    ) : (
                      <span className="text-gray-200">{l.nom}</span>
                    )}
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
                      className="text-gray-500 hover:text-red-400 text-xl leading-none"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Utilisateur</label>
            <input
              type="text"
              placeholder="Ton nom"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Note (optionnel)</label>
            <input
              type="text"
              placeholder="Ex: réception livraison SAQ, inventaire hebdo..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <button
          className="btn btn-primary w-full text-base py-3"
          onClick={submit}
          disabled={submitting || lines.length === 0}
        >
          {submitting ? 'Envoi en cours...' : `Valider le batch (${lines.length} ligne${lines.length > 1 ? 's' : ''})`}
        </button>
      </section>
    </div>
  );
}
