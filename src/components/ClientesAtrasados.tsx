import { useState } from 'react';
import { ClienteCalculado, expandirParcelasAtrasadas } from '@/types/cliente';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientes } from '@/hooks/useClientes';
import { useUserSettings } from '@/hooks/useUserSettings';
import { PinDialog } from '@/components/PinDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientesAtrasadosProps {
  clientes: ClienteCalculado[];
  hideValues?: boolean;
  hideNames?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ClientesAtrasados({ 
  clientes, 
  hideValues = false, 
  hideNames = true,
  isOpen = false,
  onOpenChange,
}: ClientesAtrasadosProps) {
  const parcelasAtrasadas = expandirParcelasAtrasadas(clientes);
  const { confirmarPagamentoRevisao } = useClientes();
  const { hasPin, verifyPin } = useUserSettings();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pendingClienteId, setPendingClienteId] = useState<string | null>(null);

  const handleConfirmarClick = (clienteId: string) => {
    if (hasPin) {
      setPendingClienteId(clienteId);
      setPinError('');
      setPinDialogOpen(true);
    } else {
      confirmarPagamentoRevisao.mutate({ clienteId, observacao: 'Pagamento confirmado via clientes atrasados' });
    }
  };

  const handlePinConfirm = (pin: string) => {
    if (verifyPin(pin)) {
      setPinDialogOpen(false);
      if (pendingClienteId) {
        confirmarPagamentoRevisao.mutate({ clienteId: pendingClienteId, observacao: 'Pagamento confirmado via clientes atrasados' });
        setPendingClienteId(null);
      }
    } else {
      setPinError('PIN incorreto');
    }
  };

  const formatCurrency = (value: number) => {
    if (hideValues) return '••••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (parcelasAtrasadas.length === 0) {
    return null;
  }

  // Count unique clients
  const clientesUnicos = new Set(parcelasAtrasadas.map(p => p.cliente.id)).size;

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card className="glass border-destructive/20">
        <CardHeader className="py-4">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left group min-h-[48px]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-destructive/20">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex flex-col justify-center">
                  <CardTitle className="text-base font-semibold text-destructive">
                    Parcelas em Atraso
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {parcelasAtrasadas.length} {parcelasAtrasadas.length === 1 ? 'parcela' : 'parcelas'} · {clientesUnicos} {clientesUnicos === 1 ? 'cliente' : 'clientes'}
                  </p>
                </div>
              </div>
              <ChevronDown className={cn(
                "w-5 h-5 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {parcelasAtrasadas.map((item) => (
                <div
                  key={`${item.cliente.id}-${item.numeroParcela}`}
                  className="group p-2.5 lg:p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 hover:border-destructive/40 hover:bg-destructive/15 transition-all duration-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm lg:text-base font-medium text-foreground truncate">
                        {hideNames ? '••••••••' : item.cliente.cliente_nome}
                      </p>
                      <p className="text-xs lg:text-sm text-muted-foreground truncate">
                        {item.cliente.produto} · Parcela {item.numeroParcela}/{item.cliente.total_parcelas}
                      </p>
                      <p className="text-[10px] text-destructive/70">
                        Venc. {format(item.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge variant="destructive" className="text-[10px] lg:text-xs px-1.5 lg:px-2 py-0 lg:py-0.5">
                        {item.diasAtraso}d
                      </Badge>
                      <p className="text-sm lg:text-base font-semibold text-foreground">
                        {formatCurrency(item.cliente.valor_parcela)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Button
                      size="sm"
                      className="w-full h-7 text-xs bg-success/10 text-success border border-success/20 hover:bg-success hover:text-success-foreground transition-colors"
                      onClick={() => handleConfirmarClick(item.cliente.id)}
                      disabled={confirmarPagamentoRevisao.isPending}
                    >
                      {confirmarPagamentoRevisao.isPending && pendingClienteId === item.cliente.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          <span>Confirmar Pagamento</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>

      <PinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        onConfirm={handlePinConfirm}
        title="Confirmar Pagamento"
        description="Digite seu PIN para confirmar o pagamento"
        error={pinError}
      />
    </Collapsible>
  );
}
