import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { ClienteCalculado } from '@/types/cliente';

interface VincularSocioDialogProps {
  open: boolean;
  onClose: () => void;
  cliente: ClienteCalculado | null;
}

export function VincularSocioDialog({ open, onClose, cliente }: VincularSocioDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [emailSocio, setEmailSocio] = useState('');
  const [percentualUser, setPercentualUser] = useState('50');
  const [percentualParceiro, setPercentualParceiro] = useState('50');
  const [isLoading, setIsLoading] = useState(false);

  const handlePercentualUserChange = (val: string) => {
    setPercentualUser(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setPercentualParceiro((100 - num).toString());
    }
  };

  const handlePercentualParceiroChange = (val: string) => {
    setPercentualParceiro(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setPercentualUser((100 - num).toString());
    }
  };

  const handleSubmit = async () => {
    if (!cliente || !emailSocio.trim()) {
      toast({ title: 'Erro', description: 'Informe o email do sócio', variant: 'destructive' });
      return;
    }

    const pctUser = parseFloat(percentualUser);
    const pctParceiro = parseFloat(percentualParceiro);
    if (isNaN(pctUser) || isNaN(pctParceiro) || pctUser <= 0 || pctParceiro <= 0 || Math.abs(pctUser + pctParceiro - 100) > 0.01) {
      toast({ title: 'Erro', description: 'Os percentuais devem somar 100%', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('vincular-cliente-existente', {
        body: {
          cliente_id: cliente.id,
          email_socio: emailSocio.trim(),
          percentual_user: pctUser,
          percentual_parceiro: pctParceiro,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Sucesso!', description: data.message });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      handleClose();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Erro ao vincular sócio', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmailSocio('');
    setPercentualUser('50');
    setPercentualParceiro('50');
    onClose();
  };

  const pctUser = parseFloat(percentualUser);
  const pctParceiro = parseFloat(percentualParceiro);
  const showPreview = cliente && !isNaN(pctUser) && !isNaN(pctParceiro) && pctUser > 0 && pctParceiro > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Vincular Sócio
          </DialogTitle>
        </DialogHeader>

        {cliente && (
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="font-medium">{cliente.cliente_nome}</p>
              <p className="text-sm text-muted-foreground">
                Valor total atual: R$ {cliente.valor_total.toFixed(2).replace('.', ',')}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email-socio-vincular" className="text-sm">Email do sócio</Label>
              <Input
                id="email-socio-vincular"
                type="email"
                placeholder="socio@email.com"
                value={emailSocio}
                onChange={(e) => setEmailSocio(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Meu %</Label>
                <Input
                  type="number"
                  min="1"
                  max="99"
                  value={percentualUser}
                  onChange={(e) => handlePercentualUserChange(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Sócio %</Label>
                <Input
                  type="number"
                  min="1"
                  max="99"
                  value={percentualParceiro}
                  onChange={(e) => handlePercentualParceiroChange(e.target.value)}
                />
              </div>
            </div>

            {showPreview && (
              <div className="text-sm text-muted-foreground space-y-0.5 p-3 rounded-lg bg-muted/50 border border-border">
                <p>Meu valor: <span className="font-medium text-foreground">R$ {(cliente.valor_total * pctUser / 100).toFixed(2).replace('.', ',')}</span></p>
                <p>Sócio: <span className="font-medium text-foreground">R$ {(cliente.valor_total * pctParceiro / 100).toFixed(2).replace('.', ',')}</span></p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
