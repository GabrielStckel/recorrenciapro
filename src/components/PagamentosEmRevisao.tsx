import { useState } from 'react';
import { ClienteCalculado } from '@/types/cliente';
import { useClientes } from '@/hooks/useClientes';
import { useUserSettings } from '@/hooks/useUserSettings';
import { PinDialog } from '@/components/PinDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PagamentosEmRevisaoProps {
  clientes: ClienteCalculado[];
}

export function PagamentosEmRevisao({ clientes }: PagamentosEmRevisaoProps) {
  const { confirmarPagamentoRevisao, marcarComoAtrasado } = useClientes();
  const { hasPin, verifyPin } = useUserSettings();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pendingClienteId, setPendingClienteId] = useState<string | null>(null);
  
  const emRevisao = clientes.filter((c) => c.em_revisao && c.status_cliente === 'ATIVO');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleConfirmar = (clienteId: string) => {
    if (hasPin) {
      setPendingClienteId(clienteId);
      setPinError('');
      setPinDialogOpen(true);
    } else {
      confirmarPagamentoRevisao.mutate({ clienteId });
    }
  };

  const handlePinConfirm = (pin: string) => {
    if (verifyPin(pin)) {
      setPinDialogOpen(false);
      if (pendingClienteId) {
        confirmarPagamentoRevisao.mutate({ clienteId: pendingClienteId });
        setPendingClienteId(null);
      }
    } else {
      setPinError('PIN incorreto');
    }
  };

  const handleNaoPagou = (clienteId: string) => {
    marcarComoAtrasado.mutate({ clienteId });
  };

  if (emRevisao.length === 0) {
    return null;
  }

  return (
    <>
    <Card className="glass border-warning/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-warning">
          <Clock className="w-4 h-4" />
          Pagamentos em Revisão
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {emRevisao.length} {emRevisao.length === 1 ? 'cliente' : 'clientes'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {emRevisao.map((cliente) => (
            <div
              key={cliente.id}
              className="group p-2.5 rounded-lg bg-warning/10 border border-warning/20 hover:border-warning/40 hover:bg-warning/15 transition-all duration-200"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{cliente.cliente_nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{cliente.produto}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-warning">
                    Venc. {format(cliente.data_vencimento_mes_atual, 'dd/MM', { locale: ptBR })}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(cliente.valor_parcela)}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs bg-success/10 text-success border border-success/20 hover:bg-success hover:text-success-foreground transition-colors px-2"
                  onClick={() => handleConfirmar(cliente.id)}
                  disabled={confirmarPagamentoRevisao.isPending}
                >
                  {confirmarPagamentoRevisao.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      <span>Pagou</span>
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition-colors px-2"
                  onClick={() => handleNaoPagou(cliente.id)}
                  disabled={marcarComoAtrasado.isPending}
                >
                  {marcarComoAtrasado.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 mr-1" />
                      <span>Não pagou</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

      <PinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        onConfirm={handlePinConfirm}
        title="Confirmar Pagamento"
        description="Digite seu PIN para confirmar o pagamento"
        error={pinError}
      />
    </>
  );
}