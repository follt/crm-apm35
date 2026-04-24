import { useEffect, useMemo, useState } from 'react';
import { Users, Pencil, Trash2, Plus, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { ClientForm, type ClientData } from '@/components/forms/ClientForm';
import { ipc } from '@/lib/ipc';

interface Client {
  id: number;
  type: 'particulier' | 'professionnel' | 'syndic';
  nom: string;
  prenom: string | null;
  raison_sociale: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  siret: string | null;
  notes: string | null;
}

const typeLabel: Record<Client['type'], string> = {
  particulier: 'Particulier',
  professionnel: 'Pro',
  syndic: 'Syndic',
};

const typeTone: Record<Client['type'], BadgeTone> = {
  particulier: 'blue',
  professionnel: 'violet',
  syndic: 'amber',
};

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-semibold text-white">
      {initials || '?'}
    </div>
  );
}

export default function ClientsList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | Client['type']>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientData | null>(null);

  const load = () => ipc.invoke<Client[]>('clients:list').then(setClients).catch(() => setClients([]));

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => clients.filter((c) => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.nom.toLowerCase().includes(q) ||
      (c.prenom?.toLowerCase() ?? '').includes(q) ||
      (c.raison_sociale?.toLowerCase() ?? '').includes(q) ||
      (c.email?.toLowerCase() ?? '').includes(q) ||
      (c.telephone?.toLowerCase() ?? '').includes(q) ||
      (c.siret ?? '').includes(q)
    );
  }), [clients, typeFilter, search]);

  const edit = (c: Client) => {
    setEditing(c as ClientData);
    setFormOpen(true);
  };

  const create = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const remove = async (c: Client) => {
    const name = c.raison_sociale || `${c.nom}${c.prenom ? ' ' + c.prenom : ''}`;
    if (!confirm(`Supprimer le client "${name}" ?`)) return;
    try {
      await ipc.invoke('clients:delete', c.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title="Clients"
        subtitle={`${filtered.length} / ${clients.length} clients`}
        actions={
          <Button onClick={create}>
            <Plus className="h-4 w-4" /> Nouveau client
          </Button>
        }
      />

      <div className="p-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher nom, email, téléphone, SIRET…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {(['all', 'particulier', 'professionnel', 'syndic'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  typeFilter === t
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'all' ? 'Tous' : typeLabel[t]}
              </button>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Client</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Email</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Téléphone</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Ville</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    <Users className="mx-auto mb-2 h-10 w-10 opacity-30" />
                    Aucun client {search ? 'pour cette recherche' : ''}
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const name = c.raison_sociale || `${c.nom}${c.prenom ? ' ' + c.prenom : ''}`;
                return (
                  <tr key={c.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={name} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">{name}</div>
                          {c.siret && <div className="truncate text-xs text-slate-400">SIRET {c.siret}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={typeTone[c.type]}>{typeLabel[c.type]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.telephone ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.ville ?? '—'}</td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="icon" onClick={() => edit(c)} title="Modifier">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(c)} title="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <ClientForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} editing={editing} />
    </div>
  );
}
