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
  AuthUser,
  Restaurant,
  UserWithAccess,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bn_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const restaurantRaw = localStorage.getItem('bn_restaurant');
  if (restaurantRaw) {
    const r = JSON.parse(restaurantRaw) as Restaurant;
    config.headers['X-Restaurant-Id'] = String(r.id);
  }

  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('bn_token');
      localStorage.removeItem('bn_user');
      localStorage.removeItem('bn_restaurant');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export const AuthApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get<AuthUser>('/auth/me').then((r) => r.data),
  myRestaurants: () => api.get<Restaurant[]>('/auth/restaurants').then((r) => r.data),
};

export const ProductsApi = {
  list: (search?: string) => api.get<Product[]>('/products', { params: { search } }).then((r) => r.data),
  byUpc: (code: string) => api.get<Product>(`/products/by-upc/${code}`).then((r) => r.data),
  create: (p: Partial<Product>) => api.post<Product>('/products', p).then((r) => r.data),
  update: (id: number, p: Partial<Product>) => api.put<Product>(`/products/${id}`, p).then((r) => r.data),
  remove: (id: number) => api.delete(`/products/${id}`).then((r) => r.data),
};

export const InventoryApi = {
  list: (search?: string, referenced?: boolean) =>
    api.get<InventoryRow[]>('/inventory', { params: { search, referenced } }).then((r) => r.data),
  summary: () => api.get<InventorySummary>('/inventory/summary').then((r) => r.data),
  nonReferenced: () => api.get<InventoryRow[]>('/inventory/non-referenced').then((r) => r.data),
  objectifs: (params?: { status?: string; inventoryOnly?: boolean }) =>
    api.get<ObjectifRow[]>('/inventory/objectifs', { params }).then((r) => r.data),
  setObjectif: (codeUpc: string, data: { minQty: number; maxQty: number; lotQty?: number | null }) =>
    api.patch(`/inventory/objectifs/${codeUpc}`, data).then((r) => r.data),
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

export const AdminApi = {
  getRestaurants: () => api.get<Restaurant[]>('/restaurants').then((r) => r.data),
  createRestaurant: (nom: string) => api.post<Restaurant>('/restaurants', { nom }).then((r) => r.data),
  updateRestaurant: (id: number, nom: string) => api.put<Restaurant>(`/restaurants/${id}`, { nom }).then((r) => r.data),
  deleteRestaurant: (id: number) => api.delete(`/restaurants/${id}`).then((r) => r.data),

  getUsers: () => api.get<UserWithAccess[]>('/users').then((r) => r.data),
  createUser: (data: { email: string; nom: string; password: string; role: string; restaurants: { restaurantId: number; restaurantRole: string }[] }) =>
    api.post<UserWithAccess>('/users', data).then((r) => r.data),
  updateUser: (id: number, data: { email: string; nom: string; role: string; password?: string; restaurants: { restaurantId: number; restaurantRole: string }[] }) =>
    api.put<UserWithAccess>(`/users/${id}`, data).then((r) => r.data),
  deleteUser: (id: number) => api.delete(`/users/${id}`).then((r) => r.data),
};

export default api;

export const JoinRequestsApi = {
  list: () => api.get('/join-requests').then((r) => r.data),
  approve: (id: number) => api.post(`/join-requests/${id}/approve`).then((r) => r.data),
  reject: (id: number) => api.post(`/join-requests/${id}/reject`).then((r) => r.data),
};

export const InvitesApi = {
  list: () => api.get('/invites').then((r) => r.data),
  create: () => api.post('/invites').then((r) => r.data),
  revoke: (id: number) => api.delete(`/invites/${id}`).then((r) => r.data),
};

export const PublicApi = {
  restaurants: () => api.get('/restaurants/public').then((r) => r.data),
  inviteInfo: (token: string) => api.get(`/auth/invite/${token}`).then((r) => r.data),
  register: (data: { email: string; nom: string; password: string; restaurantId?: number }) =>
    api.post('/auth/register', data).then((r) => r.data),
  registerWithInvite: (data: { email: string; nom: string; password: string; token: string }) =>
    api.post('/auth/register-invite', data).then((r) => r.data),
};

export const CommandesApi = {
  getConfig: () => api.get<import('../types').CommandeConfig>('/commandes/config').then(r => r.data),
  updateConfig: (data: import('../types').CommandeConfig) => api.put('/commandes/config', data).then(r => r.data),
  list: () => api.get<import('../types').CommandeSummary[]>('/commandes').then(r => r.data),
  get: (id: number) => api.get<import('../types').CommandeDetail>(`/commandes/${id}`).then(r => r.data),
  create: (data: { note?: string; items: { codeSaq: string; nomProduit: string; volume?: string | null; quantite: number }[] }) =>
    api.post<{ id: number; nbItems: number; totalBtls: number }>('/commandes', data).then(r => r.data),
  remove: (id: number) => api.delete(`/commandes/${id}`).then(r => r.data),
};
