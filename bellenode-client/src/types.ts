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
