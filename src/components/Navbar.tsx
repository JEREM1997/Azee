import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3, ChevronRight, ClipboardCheck, ClipboardList, Factory, LayoutDashboard,
  LogOut, MoreHorizontal, Settings2, ShieldCheck, Truck,
  UserRound, Users, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import krispyKremeLogo from '../assets/krispy-kreme-ops-logo.png';
import { countPendingOrders, ORDERS_CHANGED_EVENT } from '../services/ordersService';

interface NavigationItem {
  name: string;
  description: string;
  href: string;
  visible: boolean;
  icon: React.ComponentType<{ className?: string }>;
  section: 'operations' | 'management';
}

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const sheetRef = useRef<HTMLElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const { user, logout, isAdmin, isProduction } = useAuth();
  const location = useLocation();
  const canValidateOrders = isAdmin || isProduction;

  const navigation = useMemo<NavigationItem[]>(() => [
    { name: 'Vue d’ensemble', description: 'Activité du réseau', href: '/dashboard', visible: isAdmin, icon: LayoutDashboard, section: 'operations' },
    { name: 'Production', description: 'Suivi de fabrication', href: '/production', visible: isAdmin, icon: Factory, section: 'operations' },
    { name: 'Plans', description: 'Planning quotidien', href: '/plans', visible: isProduction || isAdmin, icon: ClipboardCheck, section: 'operations' },
    { name: 'Commandes', description: 'Demandes magasins', href: '/orders', visible: true, icon: ClipboardList, section: 'operations' },
    { name: 'Livraisons', description: 'Réceptions & déchets', href: '/delivery', visible: true, icon: Truck, section: 'operations' },
    { name: 'Statistiques', description: 'Analyse des performances', href: '/stats', visible: isAdmin, icon: BarChart3, section: 'management' },
    { name: 'Audit', description: 'Journal des activités', href: '/audit', visible: isAdmin, icon: ShieldCheck, section: 'management' },
    { name: 'Utilisateurs', description: 'Accès et rôles', href: '/users', visible: isAdmin, icon: Users, section: 'management' },
    { name: 'Administration', description: 'Magasins & catalogue', href: '/admin', visible: isAdmin, icon: Settings2, section: 'management' },
  ], [isAdmin, isProduction]);

  const visibleNavigation = navigation.filter(item => item.visible);
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  useEffect(() => setIsOpen(false), [location.pathname]);
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') || []);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => focusable()[0]?.focus());
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); moreButtonRef.current?.focus(); };
  }, [isOpen]);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      if (!canValidateOrders || !user) return mounted && setPendingOrdersCount(0);
      try { const count = await countPendingOrders(); if (mounted) setPendingOrdersCount(count); }
      catch (error) { console.error('Navbar: unable to load pending orders count', error); }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30000);
    window.addEventListener(ORDERS_CHANGED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    return () => { mounted = false; window.clearInterval(interval); window.removeEventListener(ORDERS_CHANGED_EVENT, refresh); window.removeEventListener('focus', refresh); };
  }, [canValidateOrders, user]);

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {(['operations', 'management'] as const).map(section => {
        const items = visibleNavigation.filter(item => item.section === section);
        if (!items.length) return null;
        return (
          <div key={section} className={mobile ? 'mb-6' : 'mb-7'}>
            <p className="nav-section-label">{section === 'operations' ? 'Opérations' : 'Pilotage'}</p>
            <div className="space-y-1">
              {items.map(item => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link key={item.href} to={item.href} className={`nav-item group ${active ? 'nav-item-active' : ''}`}>
                    <span className="nav-icon"><Icon className="h-[18px] w-[18px]" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{item.name}</span>
                      {mobile && <span className="block truncate text-xs text-slate-500">{item.description}</span>}
                    </span>
                    {item.href === '/orders' && canValidateOrders && pendingOrdersCount > 0 && (
                      <span className="nav-badge">{pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}</span>
                    )}
                    {mobile && <ChevronRight className="h-4 w-4 text-slate-300" />}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );

  const primaryMobile = visibleNavigation.filter(item => item.section === 'operations').slice(0, 4);
  const currentPage = navigation.find(item => isActive(item.href));

  return (
    <div className="min-h-screen lg:pl-[264px]">
      <a href="#main-content" className="skip-link">Aller au contenu principal</a>

      <aside className="app-sidebar hidden lg:flex" aria-label="Navigation principale">
        <Link to="/" className="sidebar-brand" aria-label="Krispy Kreme Operations — accueil">
          <img src={krispyKremeLogo} alt="Krispy Kreme Operations" className="h-[58px] w-auto object-contain" />
        </Link>
        <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-6"><NavItems /></nav>
        <div className="border-t border-slate-200/80 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-krispy-green"><UserRound className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{user?.fullName || 'Collaborateur'}</p><p className="truncate text-xs text-slate-500">{user?.email}</p></div>
          </div>
          <button onClick={() => void logout()} className="btn-secondary w-full"><LogOut className="h-4 w-4" /> Se déconnecter</button>
        </div>
      </aside>

      <header className="mobile-header lg:hidden">
        <div className="min-w-0">
          <p className="mobile-header-kicker">Krispy Kreme Operations</p>
          <p className="mobile-header-title">{currentPage?.name || 'Espace de travail'}</p>
        </div>
      </header>

      {isOpen && <div className="sheet-layer fixed inset-0 lg:hidden">
        <button className="sheet-backdrop absolute inset-0 bg-slate-950/35" onClick={() => setIsOpen(false)} aria-label="Fermer le menu" />
        <section ref={sheetRef} className="mobile-sheet absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-[24px] bg-white px-5 pb-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title">
          <div className="sheet-handle" aria-hidden="true" />
          <div className="mb-6 flex items-start justify-between"><div><p className="eyebrow">Espace de travail</p><h2 id="mobile-menu-title" className="mt-1 text-xl font-semibold text-slate-900">Navigation</h2></div><button className="icon-button" onClick={() => setIsOpen(false)} aria-label="Fermer"><X className="h-5 w-5" /></button></div>
          <NavItems mobile />
          <button onClick={() => void logout()} className="btn-secondary w-full"><LogOut className="h-4 w-4" /> Se déconnecter</button>
        </section>
      </div>}

      <main id="main-content" tabIndex={-1} className="app-main"><div key={location.pathname} className="page-enter"><Outlet /></div></main>

      <nav className="mobile-bottom-nav lg:hidden" aria-label="Navigation mobile" style={{ gridTemplateColumns: `repeat(${primaryMobile.length + 1}, minmax(0, 1fr))` }}>
        {primaryMobile.map(item => { const Icon = item.icon; const active = isActive(item.href); return <Link key={item.href} to={item.href} className={`mobile-nav-item ${active ? 'text-krispy-green' : 'text-slate-500'}`}><span className={`relative rounded-xl p-1.5 ${active ? 'bg-emerald-50' : ''}`}><Icon className="h-5 w-5" />{item.href === '/orders' && pendingOrdersCount > 0 && <i className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-krispy-red ring-2 ring-white" />}</span><span>{item.name}</span></Link>; })}
        <button ref={moreButtonRef} onClick={() => setIsOpen(true)} className={`mobile-nav-item ${isOpen ? 'text-krispy-green' : 'text-slate-500'}`} aria-haspopup="dialog" aria-expanded={isOpen}><span className={`rounded-xl p-1.5 ${isOpen ? 'bg-emerald-50' : ''}`}><MoreHorizontal className="h-5 w-5" /></span><span>Plus</span></button>
      </nav>
    </div>
  );
};

export default Navbar;
