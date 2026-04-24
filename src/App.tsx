import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import Dashboard from '@/pages/Dashboard';
import ClientsList from '@/pages/ClientsList';
import DevisList from '@/pages/DevisList';
import DevisForm from '@/pages/DevisForm';
import FacturesList from '@/pages/FacturesList';
import FactureForm from '@/pages/FactureForm';
import CatalogueList from '@/pages/CatalogueList';
import RelancesList from '@/pages/RelancesList';
import Settings from '@/pages/Settings';
import EntrepriseSettings from '@/pages/settings/EntrepriseSettings';
import EmailSettings from '@/pages/settings/EmailSettings';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<ClientsList />} />
          <Route path="devis" element={<DevisList />} />
          <Route path="devis/nouveau" element={<DevisForm />} />
          <Route path="devis/:id" element={<DevisForm />} />
          <Route path="factures" element={<FacturesList />} />
          <Route path="factures/nouveau" element={<FactureForm />} />
          <Route path="factures/:id" element={<FactureForm />} />
          <Route path="catalogue" element={<CatalogueList />} />
          <Route path="relances" element={<RelancesList />} />
          <Route path="parametres" element={<Settings />}>
            <Route index element={<Navigate to="entreprise" replace />} />
            <Route path="entreprise" element={<EntrepriseSettings />} />
            <Route path="email" element={<EmailSettings />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
