import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/scan', label: 'Scan', icon: '📷' },
  { to: '/produits', label: 'Produits', icon: '🍾' },
  { to: '/batches', label: 'Historique', icon: '📋' },
  { to: '/non-referencer', label: 'Non référencés', icon: '❓' },
  { to: '/mappings', label: 'Caisses', icon: '📦' },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-bg">
      <aside className="w-60 bg-bg-soft border-r border-bg-border flex flex-col">
        <div className="px-5 py-5 border-b border-bg-border">
          <h1 className="text-2xl font-bold tracking-wider text-accent">BELLENODE</h1>
          <p className="text-xs text-gray-500 mt-1">Gestion d'inventaire</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-gray-300 hover:bg-bg-elevated hover:text-white'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-bg-border text-xs text-gray-500">
          <div>v0.1.0 — MVP</div>
          <div className="mt-1">bellenode.com</div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-6 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
