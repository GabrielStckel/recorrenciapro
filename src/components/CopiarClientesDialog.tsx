import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, AlertTriangle, Search } from 'lucide-react';
import { ClienteCalculado } from '@/types/cliente';

interface CopiarClientesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: ClienteCalculado[];
}

export function CopiarClientesDialog({ open, onOpenChange, clientes }: CopiarClientesDialogProps) {
  const [emailSocio, setEmailSocio] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const { toast } = useToast();

  const filteredClientes = useMemo(() => {
    if (!search.trim()) return clientes;
    const q = search.toLowerCase();
    return clientes.filter(c => c.cliente_nome.toLowerCase().includes(q) || c.produto.toLowerCase().includes(q));
  }, [clientes, search]);

  const toggleAll = () => {
    if (selectedIds.size === filteredClientes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClientes.map(c => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSubmit = async () => {
    if (!confirmStep) {
      if (!emailSocio.trim() || selectedIds.size === 0) {
        toast({ title: 'Preencha o email e selecione pelo menos 1 cliente', variant: 'destructive' });
        return;
      }
      setConfirmStep(true);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('copiar-clientes', {
        body: { email_socio: emailSocio.trim(), cliente_ids: Array.from(selectedIds) },
      });

      if (error) {
        // Try to parse error body
        const msg = typeof error === 'object' && 'message' in error ? error.message : String(error);
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Clientes copiados!', description: data.message });
      handleClose();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Erro ao copiar clientes', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmailSocio('');
    setSelectedIds(new Set());
    setSearch('');
    setConfirmStep(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Copiar Clientes para Sócio
          </DialogTitle>
          <DialogDescription>
            Selecione os clientes para copiar. Os valores serão zerados para o sócio configurar na conta dele.
          </DialogDescription>
        </DialogHeader>

        {!confirmStep ? (
          <div className="space-y-4 flex-1 min-h-0 flex flex-col">
            <div className="space-y-2">
              <Label htmlFor="email-socio">Email do sócio</Label>
              <Input
                id="email-socio"
                type="email"
                placeholder="socio@email.com"
                value={emailSocio}
                onChange={(e) => setEmailSocio(e.target.value)}
              />
            </div>

            <div className="space-y-2 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between">
                <Label>Clientes ({selectedIds.size}/{clientes.length} selecionados)</Label>
                <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs h-7">
                  {selectedIds.size === filteredClientes.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <ScrollArea className="flex-1 min-h-0 max-h-[280px] border rounded-md">
                <div className="p-2 space-y-1">
                  {filteredClientes.map(c => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedIds.has(c.id)}
                        onCheckedChange={() => toggleOne(c.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.cliente_nome}</p>
                        <p className="text-xs text-muted-foreground">{c.produto} · {c.parcelas_pagas}/{c.total_parcelas} parcelas</p>
                      </div>
                    </label>
                  ))}
                  {filteredClientes.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente encontrado</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Confirmar cópia?</p>
                <p className="text-muted-foreground mt-1">
                  <strong>{selectedIds.size} cliente(s)</strong> serão copiados para <strong>{emailSocio}</strong>.
                </p>
                <p className="text-muted-foreground mt-1">
                  Os valores serão zerados — o sócio configura na conta dele. Essa ação não pode ser desfeita automaticamente.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {confirmStep && (
            <Button variant="outline" onClick={() => setConfirmStep(false)} disabled={isLoading}>
              Voltar
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isLoading || !emailSocio || selectedIds.size === 0}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Copiando...
              </>
            ) : confirmStep ? (
              'Confirmar cópia'
            ) : (
              `Continuar (${selectedIds.size})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
