import { useEffect, useState } from 'react';
import { NavLink, useLocation, matchPath } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, FileText, Receipt, Package, Bell, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ipc } from '@/lib/ipc';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/devis', label: 'Devis', icon: FileText },
  { to: '/factures', label: 'Factures', icon: Receipt },
  { to: '/catalogue', label: 'Catalogue', icon: Package },
  { to: '/relances', label: 'Relances', icon: Bell },
  { to: '/parametres', label: 'Paramètres', icon: Settings },
];

const ITEM_HEIGHT = 44; // px — matches h-11
const NAV_PT = 8; // px — matches py-2 top
const CURVE_SIZE = 24; // px — bigger concave curves for a softer blend
const TRANSITION = { type: 'tween' as const, duration: 0.38, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] };

export function Sidebar() {
  const [icon, setIcon] = useState<string | null>(null);
  const [raison, setRaison] = useState<string>('APM35');
  const location = useLocation();

  useEffect(() => {
    ipc.invoke<string | null>('config:get-icon-data-url').then((iconUrl) => {
      if (iconUrl) {
        setIcon(iconUrl);
        return;
      }
      ipc.invoke<string | null>('config:get-logo-data-url').then(setIcon).catch(() => setIcon(null));
    }).catch(() => setIcon(null));
    ipc.invoke<{ raison_sociale: string }>('config:get-entreprise').then((c) => setRaison(c.raison_sociale || 'APM35')).catch(() => void 0);
  }, []);

  const activeIndex = Math.max(0, navItems.findIndex((i) => {
    if (i.end) return location.pathname === i.to;
    return matchPath({ path: `${i.to}/*`, end: false }, location.pathname) !== null || location.pathname === i.to;
  }));

  const pillTop = NAV_PT + activeIndex * ITEM_HEIGHT;

  return (
    <aside className="relative flex h-full w-[240px] flex-shrink-0 flex-col bg-gradient-to-b from-blue-600 to-blue-700 text-white">
      <div className="h-8" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
      <div className="flex items-center gap-3 px-6 pb-6 pt-2">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5">
          {icon ? (
            <img src={icon} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <span className="text-sm font-bold text-blue-700">A</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">{raison}</p>
          <p className="text-xs text-white/60">CRM</p>
        </div>
      </div>

      <nav className="relative flex-1 py-2 pl-3 pr-0">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-3 right-0 z-0 rounded-l-full bg-white"
          initial={false}
          animate={{ top: pillTop, height: ITEM_HEIGHT }}
          transition={TRANSITION}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute right-0 z-0 bg-white"
          style={{
            width: CURVE_SIZE,
            height: CURVE_SIZE,
            WebkitMaskImage: `radial-gradient(circle at 0 0, transparent ${CURVE_SIZE}px, black ${CURVE_SIZE + 0.5}px)`,
            maskImage: `radial-gradient(circle at 0 0, transparent ${CURVE_SIZE}px, black ${CURVE_SIZE + 0.5}px)`,
          }}
          initial={false}
          animate={{ top: pillTop - CURVE_SIZE }}
          transition={TRANSITION}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute right-0 z-0 bg-white"
          style={{
            width: CURVE_SIZE,
            height: CURVE_SIZE,
            WebkitMaskImage: `radial-gradient(circle at 0 100%, transparent ${CURVE_SIZE}px, black ${CURVE_SIZE + 0.5}px)`,
            maskImage: `radial-gradient(circle at 0 100%, transparent ${CURVE_SIZE}px, black ${CURVE_SIZE + 0.5}px)`,
          }}
          initial={false}
          animate={{ top: pillTop + ITEM_HEIGHT }}
          transition={TRANSITION}
        />

        {navItems.map((item, idx) => {
          const isActive = idx === activeIndex;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={cn(
                'group relative z-10 flex items-center gap-3 pl-4 pr-4 text-sm font-medium transition-colors duration-200',
                isActive ? 'text-blue-700' : 'text-white/70 hover:text-white',
              )}
              style={{ height: ITEM_HEIGHT }}
            >
              <item.icon
                className={cn(
                  'h-5 w-5 flex-shrink-0 transition-colors duration-200',
                  isActive ? 'text-blue-600' : 'text-white/70 group-hover:text-white',
                )}
              />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-6 py-4 text-[10px] uppercase tracking-wider text-white/40">
        v0.1 · Mono-poste
      </div>
    </aside>
  );
}
