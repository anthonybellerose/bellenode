import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Scan from './pages/Scan';
import Products from './pages/Products';
import Batches from './pages/Batches';
import BatchDetail from './pages/BatchDetail';
import NonReferenced from './pages/NonReferenced';
import Mappings from './pages/Mappings';
import Objectifs from './pages/Objectifs';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/produits" element={<Products />} />
        <Route path="/objectifs" element={<Objectifs />} />
        <Route path="/batches" element={<Batches />} />
        <Route path="/batches/:id" element={<BatchDetail />} />
        <Route path="/non-referencer" element={<NonReferenced />} />
        <Route path="/mappings" element={<Mappings />} />
      </Route>
    </Routes>
  );
}
