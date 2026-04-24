import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Eye, AlertTriangle, Check, FileText, Mail, Pencil, AtSign, Settings } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ipc } from '@/lib/ipc';

type Kind = 'devis' | 'factures';

interface Props {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  kind: Kind;
  id: number | null;
  numero: string;
}

interface EmailDefaults {
  to: string | null;
  subject: string;
  message: string;
}

export function SendEmailModal({ open, onClose, onSent, kind, id, numero }: Props) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pdfOpening, setPdfOpening] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!open || !id) return;
    setError(null);
    setSuccess(null);
    setEditing(false);
    setLoading(true);
    ipc.invoke<EmailDefaults>(`${kind}:email-defaults`, id)
      .then((d) => {
        setTo(d.to ?? '');
        setSubject(d.subject);
        setMessage(d.message);
        if (!d.to) setEditing(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [open, id, kind]);

  const openPdf = async () => {
    if (!id) return;
    setPdfOpening(true);
    try {
      const { path } = await ipc.invoke<{ path: string }>(`${kind}:pdf`, id);
      await ipc.invoke('shell:open-file', path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPdfOpening(false);
    }
  };

  const send = async () => {
    if (!id) return;
    if (!to.trim()) {
      setError('Destinataire requis');
      setEditing(true);
      return;
    }
    setError(null);
    setSuccess(null);
    setSending(true);
    try {
      const result = await ipc.invoke<{ to: string }>(`${kind}:send-email`, id, {
        to: to.trim(),
        subject,
        message,
      });
      setSuccess(`Envoyé à ${result.to}`);
      onSent();
      setTimeout(() => onClose(), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const kindLabel = kind === 'devis' ? 'le devis' : 'la facture';
  const pdfLabel = kind === 'devis' ? 'Devis' : 'Facture';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Envoyer ${kindLabel} ${numero}`}
      size="lg"
    >
      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Chargement…</div>
      ) : (
        <div className="space-y-4">
          {!editing ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <AtSign className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Destinataire</div>
                    <div className="font-medium">{to || <span className="text-destructive">— Aucun email client —</span>}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-3 border-t pt-3">
                  <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Objet</div>
                    <div className="font-medium">{subject}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-3 border-t pt-3">
                  <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pièce jointe</div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{pdfLabel}_{numero}.pdf</span>
                      <Button type="button" variant="ghost" size="sm" onClick={openPdf} disabled={pdfOpening}>
                        <Eye className="h-3.5 w-3.5" /> {pdfOpening ? 'Ouverture…' : 'Aperçu'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
                Modifier le destinataire, objet ou message
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Destinataire *</Label>
                <Input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="client@exemple.fr"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Objet</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Message</Label>
                <Textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} className="text-xs leading-relaxed" />
                <p className="text-xs text-muted-foreground">Votre signature est ajoutée automatiquement.</p>
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{pdfLabel}_{numero}.pdf</span>
                <Button type="button" variant="ghost" size="sm" onClick={openPdf} disabled={pdfOpening} className="ml-auto">
                  <Eye className="h-3.5 w-3.5" /> {pdfOpening ? 'Ouverture…' : 'Aperçu PDF'}
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="flex-1">
                <div>{error}</div>
                {(/SMTP|mot de passe/i.test(error)) && (
                  <Link
                    to="/parametres/email"
                    onClick={onClose}
                    className="mt-2 inline-flex items-center gap-1 font-medium text-destructive underline underline-offset-2 hover:text-destructive/80"
                  >
                    <Settings className="h-3 w-3" />
                    Configurer le SMTP
                  </Link>
                )}
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={sending}>Annuler</Button>
            <Button type="button" onClick={send} disabled={sending || !to.trim()}>
              <Send className="h-4 w-4" />
              {sending ? 'Envoi…' : 'Envoyer'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
