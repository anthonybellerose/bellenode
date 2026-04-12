import axios from 'axios';
import type {
  Product,
  InventoryRow,
  InventorySummary,
  CaisseMapping,
  RawOp,
  ScanBatch,
  ScanBatchDetail,
  ObjectifRow,
  ObjectifStatut,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export const ProductsApi = {
  list: (search?: string) => api.get<Product[]>('/products', { params: { search } }).then((r) => r.data),
  byUpc: (code: string) => api.get<Product>(`/products/by-upc/${code}`).then((r) => r.data),
  create: (p: Partial<Product>) => api.post<Product>('/products', p).then((r) => r.data),
  update: (id: number, p: Partial<Product>) => api.put<Product>(`/products/${id}`, p).then((r) => r.data),
  remove: (id: number) => api.delete(`/products/${id}`).then((r) => r.data),
  setObjectif: (id: number, objectifQty: number | null) =>
    api.patch(`/products/${id}/objectif`, { objectifQty }).then((r) => r.data),
};

export const InventoryApi = {
  list: (search?: string, referenced?: boolean) =>
    api.get<InventoryRow[]>('/inventory', { params: { search, referenced } }).then((r) => r.data),
  summary: () => api.get<InventorySummary>('/inventory/summary').then((r) => r.data),
  nonReferenced: () => api.get<InventoryRow[]>('/inventory/non-referenced').then((r) => r.data),
  objectifs: (status?: ObjectifStatut) =>
    api.get<ObjectifRow[]>('/inventory/objectifs', { params: { status } }).then((r) => r.data),
};

export const ScanApi = {
  submitBatch: (ops: RawOp[], note?: string, createdBy?: string) =>
    api
      .post<{ batchId: number; lignesOps: number; produitsTouches: number; totalAjouts: number; totalRetraits: number }>(
        '/scan/batch',
        { note, createdBy, operations: ops },
      )
      .then((r) => r.data),
  parseText: (content: string) =>
    api.post<RawOp[]>('/scan/parse-text', { content }).then((r) => r.data),
};

export const BatchesApi = {
  list: () => api.get<ScanBatch[]>('/batches').then((r) => r.data),
  get: (id: number) => api.get<ScanBatchDetail>(`/batches/${id}`).then((r) => r.data),
};

export const MappingsApi = {
  list: () => api.get<CaisseMapping[]>('/caissemappings').then((r) => r.data),
  create: (m: Partial<CaisseMapping>) => api.post<CaisseMapping>('/caissemappings', m).then((r) => r.data),
  update: (id: number, m: Partial<CaisseMapping>) =>
    api.put<CaisseMapping>(`/caissemappings/${id}`, m).then((r) => r.data),
  remove: (id: number) => api.delete(`/caissemappings/${id}`).then((r) => r.data),
};

export default api;
