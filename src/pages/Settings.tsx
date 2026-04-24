import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';

const tabs = [
  { to: '/parametres/entreprise', label: 'Entreprise' },
  { to: '/parametres/email', label: 'Email' },
];

export default function Settings() {
  return (
    <div className="min-h-full">
      <PageHeader title="Paramètres" subtitle="Configuration entreprise et envois email" />
      <div className="px-8 pt-6">
        <div className="mb-6 inline-flex gap-1 rounded-lg bg-slate-100 p-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="px-8 pb-8">
        <Outlet />
      </div>
    </div>
  );
}
