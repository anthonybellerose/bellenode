export interface Product {
  id: number;
  codeUpc: string;
  nom: string;
  codeSaq?: string | null;
  prix?: number | null;
  unitesParCaisse?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: number;
  email: string;
  nom: string;
  role: 'User' | 'SuperAdmin';
}

export interface Restaurant {
  id: number;
  nom: string;
  isActive?: boolean;
  createdAt?: string;
  restaurantRole?: 'User' | 'Admin' | 'SuperAdmin';
}

export interface JoinRequest {
  id: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  user: { id: number; nom: string; email: string };
}

export interface InviteToken {
  id: number;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface UserWithAccess {
  id: number;
  email: string;
  nom: string;
  role: 'User' | 'SuperAdmin';
  createdAt: string;
  restaurants: { restaurantId: number; nom: string; restaurantRole: string }[];
}

export type ObjectifStatut = 'ok' | 'bas' | 'rupture' | 'ignore';

export interface ObjectifRow {
  productId: number;
  code: string;
  nom: string;
  codeSaq?: string | null;
  prix?: number | null;
  qtyActuelle: number;
  minQty?: number | null;
  maxQty?: number | null;
  lotQty?: number | null;
  aCommander?: number | null;
  statut: ObjectifStatut;
}

export interface InventoryRow {
  id: number;
  code: string;
  quantite: number;
  isReferenced: boolean;
  nom?: string | null;
  codeSaq?: string | null;
  prix?: number | null;
  updatedAt: string;
}

export interface InventorySummary {
  totalReferenced: number;
  totalNonReferenced: number;
  distinctReferenced: number;
  distinctNonReferenced: number;
  lastUpdate?: string | null;
  totalProducts: number;
  totalBatches: number;
  stockBas: number;
  stockRupture: number;
  stockCibles: number;
}

export interface CaisseMapping {
  id: number;
  codeCaisse: string;
  codeUnite: string;
  quantite: number;
  nomUnite?: string | null;
}

export type ScanModeString = '+' | '-' | '=';

export interface RawOp {
  mode: ScanModeString;
  code: string;
  quantite?: number;
}

export interface ScanBatch {
  id: number;
  note?: string | null;
  createdBy?: string | null;
  createdAt: string;
  lignesOps: number;
  produitsTouches: number;
  totalAjouts: number;
  totalRetraits: number;
}

export interface ScanBatchDetail extends ScanBatch {
  operations: {
    id: number;
    mode: 'Add' | 'Remove' | 'Set';
    code: string;
    nom?: string | null;
    quantite: number;
    isReferenced: boolean;
    qtyAvant: number;
    qtyApres: number;
  }[];
}
