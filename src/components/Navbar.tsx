import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import krispyKremeLogo from '../assets/krispy-kreme-ops-logo.png';
import { countPendingOrders, ORDERS_CHANGED_EVENT } from '../services/ordersService';

const ADMIN_MENU_PATHS = new Set(['/stats', '/audit', '/users', '/admin']);

interface NavigationItem {
  name: string;
  href: string;
  visible: boolean;
}

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const { user, logout, isAdmin, isProduction } = useAuth();
  const location = useLocation();
  const canValidateOrders = isAdmin || isProduction;

  const navigation = useMemo<NavigationItem[]>(
    () => [
      { name: 'Tableau de bord', href: '/dashboard', visible: true },
      { name: 'Production', href: '/production', visible: isProduction || isAdmin },
      { name: 'Plans', href: '/plans', visible: isProduction || isAdmin },
      { name: 'Commandes', href: '/orders', visible: true },
      { name: 'Livraison', href: '/delivery', visible: true },
      { name: 'Statistiques', href: '/stats', visible: isAdmin },
      { name: 'Audit', href: '/audit', visible: isAdmin },
      { name: 'Utilisateurs', href: '/users', visible: isAdmin },
      { name: 'Admin', href: '/admin', visible: isAdmin },
    ],
    [isAdmin, isProduction]
  );

  const desktopPrimaryNavigation = useMemo(
    () => navigation.filter(item => item.visible && !ADMIN_MENU_PATHS.has(item.href)),
    [navigation]
  );

  const desktopManagementNavigation = useMemo(
    () => navigation.filter(item => item.visible && ADMIN_MENU_PATHS.has(item.href)),
    [navigation]
  );

  const mobileNavigation = useMemo(
    () => navigation.filter(item => item.visible),
    [navigation]
  );

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    setIsOpen(false);
    setIsManagementOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;

    const refreshPendingOrdersCount = async () => {
      if (!canValidateOrders || !user) {
        if (isMounted) {
          setPendingOrdersCount(0);
        }
        return;
      }

      try {
        const count = await countPendingOrders();
        if (isMounted) {
          setPendingOrdersCount(count);
        }
      } catch (error) {
        console.error('Navbar: unable to load pending orders count', error);
      }
    };

    void refreshPendingOrdersCount();

    const intervalId = window.setInterval(() => {
      void refreshPendingOrdersCount();
    }, 30000);
    
    const handleOrdersChanged = () => {
      void refreshPendingOrdersCount();
    };
    
    const handleWindowFocus = () => {
      void refreshPendingOrdersCount();
    };

    window.addEventListener(ORDERS_CHANGED_EVENT, handleOrdersChanged);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener(ORDERS_CHANGED_EVENT, handleOrdersChanged);
      window.removeEventListener('focus', handleWindowFocus);
    };
    }, [canValidateOrders, user]);

  const renderOrdersBadge = () => {
    if (!canValidateOrders || pendingOrdersCount <= 0) {
      return null;
    }

    const displayCount = pendingOrdersCount > 99 ? '99+' : String(pendingOrdersCount);

    return (
      <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
        {displayCount}
      </span>
    );
  };

  const renderNavLabel = (item: NavigationItem) => (
    <span className="inline-flex items-center whitespace-nowrap">
      {item.name}
      {item.href === '/orders' && renderOrdersBadge()}
    </span>
  );
 
  return (
    <>
      <nav className="navbar-pattern shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <div className="flex flex-shrink-0 items-center">
              <img
                className="h-18 w-auto sm:h-20"
                src={krispyKremeLogo}
                alt="Krispy Kreme Operations"
              />
            </div>

             <div className="hidden sm:flex min-w-0 flex-1 items-center gap-4">
              <div className="ml-2 flex min-w-0 flex-1 items-center gap-4 overflow-x-auto lg:gap-6">
                {desktopPrimaryNavigation.map(item => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`${
                      isActive(item.href)
                        ? 'border-krispy-green text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex flex-shrink-0 items-center border-b-2 px-1 pt-1 text-sm font-medium`}
                  >
                    {renderNavLabel(item)}
                  </Link>
                ))}
               </div> 

               {desktopManagementNavigation.length > 0 && (
                <div className="relative hidden lg:flex flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsManagementOpen(prev => !prev)}
                    className={`${
                      desktopManagementNavigation.some(item => isActive(item.href))
                        ? 'border-krispy-green text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium`}
                  >
                    Gestion
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </button>
                
             {isManagementOpen && (
                    <div className="absolute right-0 top-full z-30 mt-3 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-xl ring-1 ring-black/5">
                      {desktopManagementNavigation.map(item => (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={() => setIsManagementOpen(false)}
                          className={`${
                            isActive(item.href)
                              ? 'bg-krispy-green-light text-krispy-green'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          } block rounded-lg px-3 py-2 text-sm font-medium`}
                        >
                          {renderNavLabel(item)}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {desktopManagementNavigation.length > 0 && (
                <div className="hidden md:flex lg:hidden flex-shrink-0">
                  <Link
                    to="/admin"
                    className={`${
                      desktopManagementNavigation.some(item => isActive(item.href))
                        ? 'border-krispy-green text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium`}
                  >
                    Gestion
                  </Link>
                </div>
              )}       
            </div>

            <div className="hidden sm:flex flex-shrink-0 items-center gap-3">
              <span className="hidden xl:block max-w-[190px] truncate text-sm text-gray-500">
                {user?.fullName || user?.email}
              </span>
              <button
                onClick={() => logout()}
                className="inline-flex items-center rounded-md border border-transparent bg-krispy-green px-3 py-2 text-sm font-medium text-white hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
              >
                Se déconnecter
              </button>
            </div>

            <div className="ml-auto flex items-center sm:hidden">
              <button
               onClick={() => setIsOpen(prev => !prev)}
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-krispy-green"  
              >
               <span className="sr-only">Ouvrir le menu</span>
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />} 
              </button>
            </div>
          </div>
        </div>

        <div className={`${isOpen ? 'block' : 'hidden'} sm:hidden border-t border-gray-200 bg-white`}>
          <div className="space-y-1 px-3 py-3">
            {mobileNavigation.map(item => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={`${
                  isActive(item.href)
                    ? 'bg-krispy-green-light text-krispy-green'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } block rounded-lg px-3 py-2 text-base font-medium`}
              >
              {renderNavLabel(item)}
              </Link>
            ))}
          </div>

          <div className="border-t border-gray-200 px-4 py-4">
            <div className="mb-3 text-sm text-gray-500">
              {user?.fullName || user?.email}  
            </div>
             <button
              onClick={() => {
                void logout();
                setIsOpen(false);
              }}
              className="inline-flex items-center rounded-md border border-transparent bg-krispy-green px-3 py-2 text-sm font-medium text-white hover:bg-krispy-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-krispy-green"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </>
  );
};

export default Navbar;
