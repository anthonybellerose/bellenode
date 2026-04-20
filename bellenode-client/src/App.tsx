import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/select-restaurant"
        element={
          <RequireAuth>
            <SelectRestaurant />
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAuth>
            <RequireRestaurant>
              <Layout />
            </RequireRestaurant>
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/produits" element={<Products />} />
        <Route path="/objectifs" element={<Objectifs />} />
        <Route path="/batches" element={<Batches />} />
        <Route path="/batches/:id" element={<BatchDetail />} />
        <Route path="/non-referencer" element={<NonReferenced />} />
        <Route path="/mappings" element={<Mappings />} />

        <Route
          path="/admin/restaurants"
          element={
            <RequireSuperAdmin>
              <AdminRestaurants />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireSuperAdmin>
              <AdminUsers />
            </RequireSuperAdmin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
