import { NavLink, Outlet } from 'react-router';
import { useDbStatus } from '../hooks/useDbStatus';
import { DbDownBanner } from './DbDownBanner';

const SECCIONES = [
  { to: '/autos', label: 'Autos' },
  { to: '/modelos', label: 'Modelos' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/vendedores', label: 'Vendedores' },
  { to: '/sucursales', label: 'Sucursales' },
] as const;

export function Layout() {
  const { dbCaida } = useDbStatus();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-grafito text-white">
        <div className="mx-auto flex max-w-6xl flex-col px-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-6 sm:px-6">
          <p className="flex items-center gap-2 pt-4 pb-1 font-display text-lg leading-none font-semibold tracking-wider uppercase sm:py-4">
            <span aria-hidden="true" className="h-5 w-1 bg-marca" />
            Concesionaria La Plata
          </p>
          <nav aria-label="Secciones" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex">
              {SECCIONES.map((s) => (
                <li key={s.to}>
                  <NavLink
                    to={s.to}
                    className={({ isActive }) =>
                      `flex h-full items-center border-b-[3px] px-3 py-3 font-display text-[0.9375rem] font-semibold tracking-wider whitespace-nowrap uppercase transition-colors sm:py-0 ${
                        isActive
                          ? 'border-marca text-white'
                          : 'border-transparent text-white/65 hover:text-white'
                      }`
                    }
                  >
                    {s.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <DbDownBanner visible={dbCaida} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-borde">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-tinta-suave sm:px-6">
          Proyecto académico — no afiliado a Honda
        </p>
      </footer>
    </div>
  );
}
