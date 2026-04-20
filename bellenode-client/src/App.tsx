import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import JoinInvite from './pages/JoinInvite';
import SelectRestaurant from './pages/SelectRestaurant';
import Dashboard from './pages/Dashboard';
import Scan from './pages/Scan';
import Products from './pages/Products';
import Batches from './pages/Batches';
import BatchDetail from './pages/BatchDetail';
import NonReferenced from './pages/NonReferenced';
import Mappings from './pages/Mappings';
import Objectifs from './pages/Objectifs';
import AdminRestaurants from './pages/Admin/AdminRestaurants';
import AdminUsers from './pages/Admin/AdminUsers';
import JoinRequests from './pages/Admin/JoinRequests';
import Invites from './pages/Admin/Invites';
import Inventaire from './pages/Inventaire';
import Commandes from './pages/Commandes';
import CommandeDetail from './pages/CommandeDetail';
import AdminEmployees from './pages/Admin/AdminEmployees';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRestaurant({ children }: { children: React.ReactNode }) {
  const { restaurant } = useAuth();
  if (!restaurant) return <Navigate to="/select-restaurant" replace />;
  return <>{children}</>;
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'SuperAdmin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireRestaurantAdmin({ children }: { children: React.ReactNode }) {
  const { isRestaurantAdmin } = useAuth();
  if (!isRestaurantAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/join" element={<JoinInvite />} />

      <Route path="/select-restaurant" element={
        <RequireAuth><SelectRestaurant /></RequireAuth>
      } />

      <Route element={
        <RequireAuth><RequireRestaurant><Layout /></RequireRestaurant></RequireAuth>
      }>
        <Route index element={<Dashboard />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/inventaire" element={<Inventaire />} />
        <Route path="/produits" element={<Products />} />
        <Route path="/objectifs" element={<Objectifs />} />
        <Route path="/batches" element={<Batches />} />
        <Route path="/batches/:id" element={<BatchDetail />} />
        <Route path="/non-referencer" element={<NonReferenced />} />
        <Route path="/mappings" element={<Mappings />} />
        <Route path="/commandes" element={<Commandes />} />
        <Route path="/commandes/:id" element={<CommandeDetail />} />

        <Route path="/admin/employees" element={
          <RequireRestaurantAdmin><AdminEmployees /></RequireRestaurantAdmin>
        }/>
        <Route path="/admin/join-requests" element={
          <RequireRestaurantAdmin><JoinRequests /></RequireRestaurantAdmin>
        } />
        <Route path="/admin/invites" element={
          <RequireRestaurantAdmin><Invites /></RequireRestaurantAdmin>
        } />
        <Route path="/admin/restaurants" element={
          <RequireSuperAdmin><AdminRestaurants /></RequireSuperAdmin>
        } />
        <Route path="/admin/users" element={
          <RequireSuperAdmin><AdminUsers /></RequireSuperAdmin>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
