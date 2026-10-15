import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AutosPage } from './features/autos/AutosPage';
import { ClientesPage } from './features/clientes/ClientesPage';
import { ModelosPage } from './features/modelos/ModelosPage';
import { SucursalesPage } from './features/sucursales/SucursalesPage';
import { VendedoresPage } from './features/vendedores/VendedoresPage';
import { Layout } from './shared/components/Layout';
import { NotFoundPage } from './shared/components/NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/autos" replace />} />
          <Route path="autos" element={<AutosPage />} />
          <Route path="modelos" element={<ModelosPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="vendedores" element={<VendedoresPage />} />
          <Route path="sucursales" element={<SucursalesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
