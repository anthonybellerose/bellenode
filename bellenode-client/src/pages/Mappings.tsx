import { useEffect, useState } from 'react';
import { MappingsApi } from '../api/client';
import type { CaisseMapping } from '../types';

export default function Mappings() {
  const [mappings, setMappings] = useState<CaisseMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CaisseMapping | null>(null);

  async function load() {
    setLoading(true);
    try {
      setMappings(await MappingsApi.list());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(m: Partial<CaisseMapping>) {
    if (editing?.id) {
      await MappingsApi.update(editing.id, m);
    } else {
      await MappingsApi.create(m);
    }
    setShowForm(false);
    setEditing(null);
    load();
  }

  async function remove(m: CaisseMapping) {
    if (!confirm(`Supprimer le mapping ${m.codeCaisse} ?`)) return;
    await MappingsApi.remove(m.id);
    load();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Mappings caisses</h2>
          <p className="text-gray-400 mt-1">
            Codes de caisses et leur équivalent en bouteilles individuelles — {mappings.length}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + Nouveau mapping
        </button>
      </header>

      <section className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : mappings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun mapping défini.</div>
        ) : (
          <table className="table-default">
            <thead>
              <tr>
                <th>Code caisse</th>
                <th>Code bouteille</th>
                <th>Nom bouteille</th>
                <th className="text-right">Quantité</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono text-xs text-gray-300">{m.codeCaisse}</td>
                  <td className="font-mono text-xs text-gray-400">{m.codeUnite}</td>
                  <td className="text-gray-200">{m.nomUnite ?? <span className="text-gray-600">—</span>}</td>
                  <td className="text-right font-semibold text-accent">× {m.quantite}</td>
                  <td className="text-right">
                    <button
                      className="text-accent hover:text-accent-hover text-xs mr-2"
                      onClick={() => {
                        setEditing(m);
                        setShowForm(true);
                      }}
                    >
                      Éditer
                    </button>
                    <button
                      className="text-red-400 hover:text-red-300 text-xs"
                      onClick={() => remove(m)}
                    >
                      Suppr
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showForm && (
        <MappingForm
          initial={editing}
          onSave={save}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MappingForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: CaisseMapping | null;
  onSave: (m: Partial<CaisseMapping>) => void;
  onCancel: () => void;
}) {
  const [codeCaisse, setCodeCaisse] = useState(initial?.codeCaisse ?? '');
  const [codeUnite, setCodeUnite] = useState(initial?.codeUnite ?? '');
  const [quantite, setQuantite] = useState(initial?.quantite.toString() ?? '12');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg space-y-4">
        <h3 className="text-xl font-bold">{initial ? 'Modifier le mapping' : 'Nouveau mapping'}</h3>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Code de la caisse</label>
          <input
            type="text"
            value={codeCaisse}
            onChange={(e) => setCodeCaisse(e.target.value)}
            className="w-full font-mono"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Code de la bouteille unitaire</label>
          <input
            type="text"
            value={codeUnite}
            onChange={(e) => setCodeUnite(e.target.value)}
            className="w-full font-mono"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Quantité par caisse</label>
          <input
            type="number"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button className="btn btn-ghost" onClick={onCancel}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              onSave({ codeCaisse, codeUnite, quantite: parseInt(quantite) || 1 })
            }
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
