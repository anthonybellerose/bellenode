# CLAUDE.md — Instructions pour agents qui travaillent sur Bellenode

Ce fichier est lu automatiquement par Claude Code quand il ouvre ce repo. Il contient le contexte essentiel pour qu'un agent puisse reprendre le projet sans friction.

## Quoi lire en premier

1. **Ce fichier** (CLAUDE.md) — contexte immédiat
2. **Repo mémoire séparé**: [`JimR74/bellenode-memory`](https://github.com/JimR74/bellenode-memory) → `project_bellenode.md` — historique complet, décisions, leçons, état courant, roadmap
3. [`README.md`](README.md) — structure du projet et commandes de base

**Si c'est ta première session sur ce projet**, clone aussi `bellenode-memory` localement:
```bash
gh repo clone JimR74/bellenode-memory C:/Users/JimmieRoy/bellenode-memory
```

## Vue d'ensemble

**Bellenode** est une app de gestion d'inventaire pour bar/restaurant, développée pour le neveu de Jimmie. Elle remplace un prototype shell que le neveu avait développé (voir `projet_inventaire.tar.gz` qui n'est pas dans le repo).

- **Domaine**: https://bellenode.com (live)
- **Stack**: ASP.NET Core 9 + EF Core 9 + React 18 + Vite + TypeScript + Tailwind CSS
- **DB**: MSSQL hébergée sur SmarterASP (`db_a13a40_bellenode` @ `sql5110.site4now.net`)
- **Hébergement**: SmarterASP shared (`win8073.site4now.net` en FTP)
- **DNS**: Namecheap (domaine) → Cloudflare (proxy + SSL Full) → SmarterASP (origine)

## Structure du repo

```
Bellenode/
├── CLAUDE.md                 ← ce fichier
├── README.md                 ← doc technique
├── BellenodeApi/             ← backend .NET 9
│   ├── BellenodeApi.csproj
│   ├── Program.cs            ← CORS, EF, SPA hosting, seed au boot
│   ├── appsettings.json      ← connection string (OK car repo privé)
│   ├── web.config            ← IIS aspNetCore handler (OutOfProcess)
│   ├── Models/               ← Product, CaisseMapping, InventoryItem, ScanBatch, ScanOperation
│   ├── Data/
│   │   ├── BellenodeDbContext.cs
│   │   └── SeedData.cs       ← 72 produits SAQ, 17 mappings, 71 objectifs
│   ├── Controllers/
│   │   ├── ProductsController.cs
│   │   ├── InventoryController.cs
│   │   ├── ScanController.cs
│   │   ├── BatchesController.cs
│   │   └── CaisseMappingsController.cs
│   └── Migrations/           ← EF Core: InitialCreate + AddProductObjectif
├── bellenode-client/         ← frontend React
│   ├── package.json
│   ├── vite.config.ts        ← proxy /api → :5180
│   ├── tailwind.config.js    ← thème noir/bleu
│   └── src/
│       ├── App.tsx           ← routes
│       ├── main.tsx
│       ├── types.ts
│       ├── api/client.ts     ← axios instance
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── BarcodeScanner.tsx        ← caméra plein écran multi-shot
│       │   └── UpcInputWithScanner.tsx   ← input + 📷 single-shot
│       └── pages/
│           ├── Dashboard.tsx
│           ├── Scan.tsx
│           ├── Products.tsx
│           ├── Objectifs.tsx
│           ├── Batches.tsx
│           ├── BatchDetail.tsx
│           ├── NonReferenced.tsx
│           └── Mappings.tsx
└── deploy.py                 ← script FTP workflow app_offline.htm
```

## Conventions de code

**Backend**:
- Namespace: `BellenodeApi`
- Controllers: `[ApiController] [Route("api/[controller]")]`, constructor injection du `BellenodeDbContext`
- Response: `IActionResult` avec `Ok()`, `NotFound()`, `BadRequest()`
- **ATTENTION EF Core 9**: ne pas utiliser `select new PositionalRecord(...)` dans LINQ avec left outer join — ne se traduit pas en SQL, renvoie 500. Utiliser Dictionary lookup en mémoire à la place (voir `InventoryController.GetAll` comme exemple).
- Modèles: PascalCase, nullable activé (`#nullable enable`), annotations `[Required]`, `[MaxLength]`
- Migration: `dotnet ef migrations add <Nom>` depuis `BellenodeApi/`
- Auto-seed au démarrage via `SeedData.InitializeAsync` dans `Program.cs`
- Prix en `decimal(10,2)`, pas de `double`

**Frontend**:
- TypeScript strict, types dans `types.ts`
- API calls via `api/client.ts` (ProductsApi, InventoryApi, ScanApi, BatchesApi, MappingsApi)
- Tailwind classes utilitaires, composants custom dans `index.css` (`.btn`, `.card`, `.badge`, `.table-default`)
- Thème: `bg-bg` (noir quasi-total), `bg-bg-card` (cards), `bg-bg-elevated`, `text-accent` (bleu `#3b82f6`)
- Touch targets **min 44px** (standard iOS HIG), inputs **font-size 16px** pour empêcher zoom iOS
- Pages ont `<header className="hidden md:block">` (le header mobile est dans Layout.tsx)
- **Tables → mobile cards**: chaque page avec liste a 2 layouts (`<ul className="md:hidden">` et `<table className="hidden md:block">`)
- Pour scanner un code UPC dans un form: utiliser `<UpcInputWithScanner value={x} onChange={setX} />`

**Commits**: messages en français/anglais mélange, toujours avec trailer:
```
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## Comment lancer en local

### Prérequis
- .NET SDK 9 ou plus (le csproj cible `net9.0`)
- Node.js 20+ et npm
- dotnet-ef tools: `dotnet tool install --global dotnet-ef`

### Backend
```bash
cd BellenodeApi
dotnet restore
dotnet run
```
API sur `http://localhost:5180`. Swagger sur `http://localhost:5180/swagger` (Development only).

La BD est en production (MSSQL SmarterASP) et les migrations tournent automatiquement au démarrage. **Ne PAS lancer en local si tu ne veux pas toucher aux données prod** — ou changer la connection string vers une LocalDB.

### Frontend
```bash
cd bellenode-client
npm install
npm run dev
```
UI sur `http://localhost:5173`. Proxy `/api` → `http://localhost:5180` configuré dans `vite.config.ts`.

## Comment déployer

Le workflow canonique est dans `deploy.py` à la racine. Étapes:

```bash
# 1. Build backend Release
cd BellenodeApi
dotnet publish -c Release -o publish

# 2. Build frontend prod
cd ../bellenode-client
npm run build

# 3. Copier le frontend dans wwwroot du publish
cp -r dist/* ../BellenodeApi/publish/wwwroot/

# 4. Deploy via FTP (script Python ftplib)
cd ..
python deploy.py
```

`deploy.py` fait:
1. Upload `app_offline.htm` à la racine (arrête le pool IIS pour libérer les locks)
2. Supprime les anciens fichiers `default.htm`, `index.html`
3. Upload récursif de `publish/*` (~55 fichiers, ~19 MB, ~65s)
4. Supprime `app_offline.htm` → cold start IIS (5-15s) → site live

**Credentials FTP** sont dans le script. Repo privé donc OK pour MVP.

## Gotchas connus (leçons apprises par sang)

1. **SSL SmarterASP — vérifier l'épellation du domaine d'abord** — une fois 3h perdues à chasser le format PFX alors que le mapping SmarterASP avait un typo (`bellnode.com` au lieu de `bellenode.com`).
2. **`hostingModel="inprocess"` échoue en 500.34** sur le shared pool SmarterASP. Toujours utiliser `OutOfProcess` dans `web.config`.
3. **Cloudflare bloque `Python-urllib`** en POST → ajouter un User-Agent browser réaliste dans les scripts Python qui appellent `/api`.
4. **BarcodeDetector API n'existe pas sur Safari iOS**. Le fallback affiche un message clair. Si le neveu utilise iPhone, il doit scanner via lecteur Bluetooth (clavier HID).
5. **EF Core 9 record projection**: pas de `select new Record(...)` avec left join. Utiliser Dictionary + anonymous type.
6. **Cloudflare SSL mode = Full** (pas Strict). Le cert origine est self-signed, donc la chaîne ne valide pas en Strict.

## Comment tester rapidement

| Feature | Test |
|---|---|
| Dashboard | Visiter `https://bellenode.com` — voir les stats, alertes |
| Scan manuel | `/scan` → taper `4901777035614` (Midori) → Entrée → valider |
| Scan caméra | `/scan` → 📷 → autoriser caméra → scanner une bouteille |
| Produits search scanner | `/produits` → 📷 dans barre recherche → scan bouteille existante |
| Objectifs | `/objectifs` filtre Alertes → voir les ruptures/bas |
| Batch history | `/batches` → cliquer un batch → voir opérations avant/après |
| API direct | `curl https://bellenode.com/api/products` — doit retourner 72 produits |

## Ce qui n'est PAS dans le repo (à obtenir si besoin)

- **Credentials SmarterASP control panel** (URL `https://www.smarterasp.net/controlpanel/`) — ask Jimmie
- **Compte Cloudflare du neveu** — ask Jimmie (ou neveu direct)
- **Namecheap account** (propriétaire du domaine) — le neveu
- **Archive `projet_inventaire.tar.gz`** — était sur `C:\Users\JimmieRoy\Downloads\`, peut-être encore là. C'est le prototype shell d'origine dont on a porté la logique métier.
- **Fichier `inventaire.txt`** d'import initial — sur `C:\Users\JimmieRoy\Downloads\inventaire.txt`, 68 lignes `code qty`. A été importé en batch #1 dans la prod.

## Roadmap / TODOs suggérés

Voir `project_bellenode.md` section "À faire" dans le repo `bellenode-memory`. En résumé:
1. Authentification (JWT + rôles Owner/Manager/Employee)
2. Multi-tenant (plusieurs bars)
3. Export CSV/Excel
4. Graphs consommation (Recharts)
5. Alertes email stock bas
6. Investigation du code `4003310012363` (19 unités non référencées après l'import — probablement un produit légitime à ajouter au catalogue)
7. Migrer les credentials DB vers user-secrets / env vars

## Note finale

Si tu es un agent Claude qui reprend le projet: ne pas refaire les erreurs que j'ai déjà faites (voir section Gotchas). Lire `project_bellenode.md` dans `bellenode-memory` avant de proposer des changements architecturaux, il y a beaucoup de contexte sur les décisions.

Si tu es un humain (neveu, autre dev): tout est conçu pour être reproductible. Clone les 2 repos (`Bellenode` + `bellenode-memory`), installe .NET 9 SDK + Node 20+, suis les commandes ci-dessus. Le backend tourne en local contre la prod DB par défaut — attention aux manipulations si tu ne veux pas casser les données live.
