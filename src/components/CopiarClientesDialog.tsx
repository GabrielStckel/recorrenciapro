import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, AlertTriangle } from 'lucide-react';

interface CopiarClientesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalClientes: number;
}

export function CopiarClientesDialog({ open, onOpenChange, totalClientes }: CopiarClientesDialogProps) {
  const [emailSocio, setEmailSocio] = useState('');
  const [percentual, setPercentual] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    const pct = parseFloat(percentual);
    if (!emailSocio.trim() || isNaN(pct) || pct <= 0 || pct > 100) {
      toast({ title: 'Preencha email e percentual válido (1-100)', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('copiar-clientes', {
        body: { email_socio: emailSocio.trim(), percentual: pct },
      });

      if (error) throw error;
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
    setPercentual('');
    setConfirmStep(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Copiar Clientes para Sócio
          </DialogTitle>
          <DialogDescription>
            Copia todos os seus {totalClientes} clientes para a conta do sócio, ajustando o valor total pela porcentagem dele.
          </DialogDescription>
        </DialogHeader>

        {!confirmStep ? (
          <div className="space-y-4">
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
            <div className="space-y-2">
              <Label htmlFor="percentual">Percentual do sócio (%)</Label>
              <Input
                id="percentual"
                type="number"
                min="1"
                max="100"
                placeholder="Ex: 30"
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
              />
              {percentual && !isNaN(parseFloat(percentual)) && (
                <p className="text-xs text-muted-foreground">
                  Ex: Cliente de R$ 1.000 → sócio verá R$ {((1000 * parseFloat(percentual)) / 100).toFixed(2)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Confirmar cópia?</p>
                <p className="text-muted-foreground mt-1">
                  Serão copiados <strong>{totalClientes} clientes</strong> para <strong>{emailSocio}</strong> com <strong>{percentual}%</strong> do valor total.
                </p>
                <p className="text-muted-foreground mt-1">
                  Essa ação não pode ser desfeita automaticamente.
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
          <Button onClick={handleSubmit} disabled={isLoading || !emailSocio || !percentual}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Copiando...
              </>
            ) : confirmStep ? (
              'Confirmar cópia'
            ) : (
              'Continuar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
