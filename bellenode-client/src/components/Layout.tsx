import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, restaurant, isRestaurantAdmin, logout } = useAuth();

  const isSuperAdmin = user?.role === 'SuperAdmin';

  const allNavItems = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/scan', label: 'Scan', icon: '📷' },
    { to: '/batches', label: 'Historique', icon: '📋' },
    ...(isRestaurantAdmin
      ? [
          { to: '/produits', label: 'Produits', icon: '🍾' },
          { to: '/objectifs', label: 'Objectifs', icon: '🎯' },
          { to: '/non-referencer', label: 'Non référencés', icon: '❓' },
          { to: '/mappings', label: 'Caisses', icon: '📦' },
          { to: '/admin/join-requests', label: 'Demandes', icon: '🔔' },
          { to: '/admin/invites', label: 'Invitations', icon: '🔗' },
        ]
      : []),
    ...(isSuperAdmin
      ? [
          { to: '/admin/restaurants', label: 'Restaurants', icon: '🏪' },
          { to: '/admin/users', label: 'Utilisateurs', icon: '👥' },
        ]
      : []),
  ];

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const currentItem = allNavItems.find((i) =>
    i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to),
  );

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-bg-soft border-r border-bg-border flex-col fixed inset-y-0 left-0">
        <div className="px-5 py-5 border-b border-bg-border">
          <h1 className="text-2xl font-bold tracking-wider text-accent">BELLENODE</h1>
          <p className="text-xs text-gray-500 mt-1">Gestion d'inventaire</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-colors ${
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
        <div className="p-3 border-t border-bg-border text-xs text-gray-500 space-y-1">
          {restaurant && <div className="text-gray-300 font-medium truncate">{restaurant.nom}</div>}
          <div className="text-gray-500">{user?.nom}</div>
          <button onClick={() => { logout(); navigate('/login'); }} className="text-red-400 hover:text-red-300">Déconnexion</button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-bg-soft border-b border-bg-border h-14 flex items-center px-3 gap-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          className="w-11 h-11 flex items-center justify-center rounded-md hover:bg-bg-elevated active:bg-bg-border"
        >
          <svg className="w-6 h-6 text-gray-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-500 truncate">Bellenode</div>
          <div className="text-base font-semibold text-white truncate leading-tight">
            {currentItem ? (
              <>
                <span className="mr-1">{currentItem.icon}</span>
                {currentItem.label}
              </>
            ) : (
              'Chargement...'
            )}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-bg-soft border-r border-bg-border flex flex-col">
            <div className="px-5 py-5 border-b border-bg-border flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-wider text-accent">BELLENODE</h1>
                <p className="text-xs text-gray-500 mt-1">Gestion d'inventaire</p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Fermer"
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {allNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-4 rounded-md text-base transition-colors ${
                      isActive
                        ? 'bg-accent text-white'
                        : 'text-gray-200 hover:bg-bg-elevated'
                    }`
                  }
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-bg-border text-xs text-gray-500 space-y-1">
              {restaurant && <div className="text-gray-300 font-medium truncate">{restaurant.nom}</div>}
              <div>{user?.nom}</div>
              <button onClick={() => { logout(); navigate('/login'); }} className="text-red-400 hover:text-red-300">Déconnexion</button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-60 pt-14 md:pt-0 overflow-x-hidden">
        <div className="px-4 py-4 md:px-8 md:py-6 max-w-[1600px] mx-auto pb-20 md:pb-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
