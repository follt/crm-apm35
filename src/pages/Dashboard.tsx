import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, AlertCircle, TrendingUp, TrendingDown, ArrowRight, Eye } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { ipc } from '@/lib/ipc';
import { formatEuros, formatDate } from '@/lib/utils';

interface DashboardStats {
  ca_mois: number;
  ca_mois_variation: number | null;
  impayes_count: number;
  impayes_montant: number;
  devis_en_attente: number;
  taux_conversion: number;
  devis_status: Record<'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'expiré', number>;
  monthly_ca: Array<{ month: string; ca: number }>;
  recent_devis: Array<{
    id: number;
    numero: string;
    client_nom: string;
    statut: 'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'expiré';
    date_emission: string;
    total_ttc: number;
    objet: string;
  }>;
  overdue_factures: Array<{
    id: number;
    numero: string;
    client_nom: string;
    date_echeance: string;
    total_ttc: number;
    montant_paye: number;
    jours_retard: number;
  }>;
}

const devisStatutTone: Record<DashboardStats['devis_status'] extends Record<infer K, number> ? K : never, BadgeTone> = {
  brouillon: 'slate',
  envoyé: 'blue',
  accepté: 'emerald',
  refusé: 'red',
  expiré: 'amber',
};

const STATUS_COLORS: Record<keyof DashboardStats['devis_status'], string> = {
  brouillon: '#94A3B8',
  envoyé: '#3B82F6',
  accepté: '#10B981',
  refusé: '#EF4444',
  expiré: '#F59E0B',
};

function StatCard({
  label,
  value,
  subvalue,
  variation,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  subvalue?: string;
  variation?: number | null;
  icon: typeof Users;
  tone: 'blue' | 'emerald' | 'red' | 'amber' | 'violet';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  const showVar = variation !== null && variation !== undefined;
  const isPos = showVar && variation! >= 0;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {showVar && (
              <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${isPos ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {isPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isPos ? '+' : ''}{variation!.toFixed(0)} %
              </span>
            )}
            {subvalue && <span className="text-slate-500">{subvalue}</span>}
          </div>
        </div>
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'short' });
}

function fillMonths(data: Array<{ month: string; ca: number }>): Array<{ month: string; label: string; ca: number }> {
  const result: Array<{ month: string; label: string; ca: number }> = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const found = data.find((r) => r.month === key);
    result.push({ month: key, label: formatMonthLabel(key), ca: found?.ca ?? 0 });
  }
  return result;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [clientsCount, setClientsCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, clients] = await Promise.all([
          ipc.invoke<DashboardStats>('dashboard:stats'),
          ipc.invoke<unknown[]>('clients:list'),
        ]);
        setStats(s);
        setClientsCount(clients.length);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const monthlyFilled = stats ? fillMonths(stats.monthly_ca) : [];
  const statusPie = stats
    ? (Object.entries(stats.devis_status) as Array<[keyof DashboardStats['devis_status'], number]>)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: k, value: v, color: STATUS_COLORS[k] }))
    : [];
  const totalDevis = statusPie.reduce((s, x) => s + x.value, 0);

  return (
    <div className="min-h-full">
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de votre activité" />

      <div className="p-8">
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>Erreur : {error}</span>
          </div>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="CA du mois"
                value={formatEuros(stats.ca_mois)}
                variation={stats.ca_mois_variation}
                subvalue="vs mois dernier"
                icon={TrendingUp}
                tone="emerald"
              />
              <StatCard
                label="Factures impayées"
                value={formatEuros(stats.impayes_montant)}
                subvalue={`${stats.impayes_count} facture${stats.impayes_count > 1 ? 's' : ''}`}
                icon={AlertCircle}
                tone="red"
              />
              <StatCard
                label="Devis en attente"
                value={String(stats.devis_en_attente)}
                subvalue={`${stats.taux_conversion.toFixed(0)}% de conversion`}
                icon={FileText}
                tone="amber"
              />
              <StatCard
                label="Clients actifs"
                value={String(clientsCount)}
                subvalue="Particuliers, pros, syndics"
                icon={Users}
                tone="blue"
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2 p-6">
                <div className="mb-1 flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Chiffre d'affaires</h3>
                    <p className="text-xs text-slate-500">12 derniers mois, TTC</p>
                  </div>
                </div>
                <div className="mt-4 h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyFilled} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#2563EB" stopOpacity={0.75} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v === 0 ? '0' : `${Math.round(Number(v) / 1000)}k`} />
                      <Tooltip
                        cursor={{ fill: '#EFF6FF' }}
                        contentStyle={{ border: 'none', borderRadius: 8, boxShadow: '0 4px 20px rgba(15,23,42,0.12)', fontSize: 12 }}
                        labelStyle={{ fontWeight: 600 }}
                        formatter={((v: unknown) => [formatEuros(Number(v)), 'CA']) as never}
                      />
                      <Bar dataKey="ca" fill="url(#barGradient)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6">
                <div className="mb-1 flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Devis par statut</h3>
                    <p className="text-xs text-slate-500">Total : {totalDevis}</p>
                  </div>
                </div>
                {statusPie.length === 0 ? (
                  <div className="flex h-[240px] items-center justify-center text-sm text-slate-400">
                    Aucun devis
                  </div>
                ) : (
                  <>
                    <div className="mt-2 h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusPie}
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {statusPie.map((e) => <Cell key={e.name} fill={e.color} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={{ border: 'none', borderRadius: 8, boxShadow: '0 4px 20px rgba(15,23,42,0.12)', fontSize: 12 }}
                            formatter={((v: unknown, n: unknown) => [Number(v), String(n)]) as never}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs">
                      {statusPie.map((s) => (
                        <li key={s.name} className="flex items-center justify-between">
                          <span className="flex items-center gap-2 capitalize text-slate-600">
                            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                            {s.name}
                          </span>
                          <span className="font-medium text-slate-900">{s.value}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Derniers devis</h3>
                    <p className="text-xs text-slate-500">5 plus récents</p>
                  </div>
                  <Link to="/devis" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                    Tout voir <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                {stats.recent_devis.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-400">Aucun devis</div>
                ) : (
                  <ul className="divide-y divide-slate-50">
                    {stats.recent_devis.map((d) => (
                      <li key={d.id} className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-slate-50/60">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-400">{d.numero}</span>
                            <Badge tone={devisStatutTone[d.statut]} className="capitalize">{d.statut}</Badge>
                          </div>
                          <div className="mt-0.5 truncate text-sm font-medium text-slate-900">{d.client_nom.trim()}</div>
                          <div className="truncate text-xs text-slate-500">{d.objet}</div>
                        </div>
                        <div className="ml-3 flex-shrink-0 text-right">
                          <div className="text-sm font-semibold text-slate-900">{formatEuros(d.total_ttc)}</div>
                          <div className="text-xs text-slate-400">{formatDate(d.date_emission)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Factures en retard</h3>
                    <p className="text-xs text-slate-500">À relancer en priorité</p>
                  </div>
                  <Link to="/relances" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                    Tout voir <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                {stats.overdue_factures.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-10 text-center text-sm text-slate-400">
                    <Eye className="mb-2 h-8 w-8 opacity-30" />
                    Aucune facture en retard
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-50">
                    {stats.overdue_factures.map((f) => {
                      const du = f.total_ttc - f.montant_paye;
                      const retard = f.jours_retard;
                      return (
                        <li key={f.id} className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-slate-50/60">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-slate-400">{f.numero}</span>
                              <Badge tone={retard > 30 ? 'red' : 'amber'}>{retard} j</Badge>
                            </div>
                            <div className="mt-0.5 truncate text-sm font-medium text-slate-900">{f.client_nom.trim()}</div>
                            <div className="text-xs text-slate-500">Échéance : {formatDate(f.date_echeance)}</div>
                          </div>
                          <div className="ml-3 flex-shrink-0 text-right">
                            <div className="text-sm font-semibold text-red-700">{formatEuros(du)}</div>
                            <div className="text-xs text-slate-400">dû</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
