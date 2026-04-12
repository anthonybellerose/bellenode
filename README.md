# Bellenode

Application de gestion d'inventaire pour bar/restaurant. Basée sur le projet shell `projet_inventaire` porté en version web ASP.NET Core + React.

## Stack

- **Backend**: ASP.NET Core 8 Web API, Entity Framework Core, SQL Server
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **BD**: MSSQL SmarterASP (`db_a13a40_bellenode`)
- **Hébergement**: SmarterASP (https://bellenode.com)

## Structure

```
Bellenode/
├── BellenodeApi/          ← backend .NET 8
│   ├── Controllers/       ← Products, Inventory, Scan, Batches, CaisseMappings
│   ├── Data/              ← DbContext + seed (73 produits + mappings)
│   ├── Models/            ← Product, InventoryItem, ScanBatch, ScanOperation, CaisseMapping
│   └── Program.cs
├── bellenode-client/      ← frontend React
│   └── src/
│       ├── pages/         ← Dashboard, Scan, Products, Batches, NonReferenced, Mappings
│       ├── components/    ← Layout avec sidebar
│       ├── api/           ← client axios
│       └── types.ts
├── app_offline.htm        ← page de maintenance IIS
├── default.htm / index.html ← page par défaut (sert la maintenance en attendant)
└── README.md
```

## Fonctionnalités MVP

- **Dashboard**: résumé de l'inventaire, derniers produits modifiés
- **Scan**: saisie rapide avec modes `+` (ajout), `−` (retrait), `=` (fixer), support lecteur USB, import texte en bulk, conversion automatique caisses → bouteilles
- **Produits**: CRUD complet sur le catalogue (73 produits pré-importés : Midori, Bacardi, Baileys, Jägermeister, vins, etc.)
- **Historique**: liste de tous les batches avec détails (avant/après par opération)
- **Non référencés**: codes scannés qui ne sont pas dans le catalogue, avec bouton "Ajouter au catalogue"
- **Mappings caisses**: CRUD sur les codes de caisses → bouteilles unitaires

## Développement local

### Backend

Prérequis: .NET 8 SDK

```bash
cd BellenodeApi
dotnet restore
dotnet tool install --global dotnet-ef   # première fois
dotnet ef migrations add InitialCreate
dotnet run
```

L'API démarre sur `http://localhost:5180`. Swagger UI sur `http://localhost:5180/swagger`.

La BD est auto-migrée et seedée au démarrage.

### Frontend

Prérequis: Node.js 20+

```bash
cd bellenode-client
npm install
npm run dev
```

Le frontend démarre sur `http://localhost:5173` avec proxy `/api` → `http://localhost:5180`.

## Endpoints API

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/products` | Liste des produits (?search=) |
| GET | `/api/products/by-upc/{code}` | Lookup par UPC |
| POST/PUT/DELETE | `/api/products` | CRUD |
| GET | `/api/inventory` | Liste inventaire avec jointure produits |
| GET | `/api/inventory/summary` | Totaux dashboard |
| GET | `/api/inventory/non-referenced` | Produits scannés non référencés |
| POST | `/api/scan/batch` | Soumet un batch d'opérations |
| POST | `/api/scan/parse-text` | Parse le format texte historique (+, -, =) |
| GET | `/api/batches` | Historique des batches |
| GET | `/api/batches/{id}` | Détail + opérations |
| GET/POST/PUT/DELETE | `/api/caissemappings` | CRUD mappings |

## Thème UI

Fond noir/gris très foncé (`#0a0a0d`), cards `#16181f`, accents bleus (`#3b82f6`). Sélections bleues, texte principal blanc/gris clair.
