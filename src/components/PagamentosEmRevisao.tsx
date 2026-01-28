import { ClienteCalculado } from '@/types/cliente';
import { useClientes } from '@/hooks/useClientes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface PagamentosEmRevisaoProps {
  clientes: ClienteCalculado[];
}

export function PagamentosEmRevisao({ clientes }: PagamentosEmRevisaoProps) {
  const { confirmarPagamentoRevisao, marcarComoAtrasado } = useClientes();
  
  const emRevisao = clientes.filter((c) => c.em_revisao && c.status_cliente === 'ATIVO');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleConfirmar = (clienteId: string) => {
    confirmarPagamentoRevisao.mutate({ clienteId });
  };

  const handleNaoPagou = (clienteId: string) => {
    marcarComoAtrasado.mutate({ clienteId });
  };

  if (emRevisao.length === 0) {
    return (
      <Card className="glass border-success/20">
        <CardContent className="p-3 sm:p-4 text-center">
          <p className="text-success text-sm">✓ Nenhum pagamento pendente de revisão</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-warning/30">
      <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-4">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-warning">
          <Clock className="w-4 h-4" />
          Em Revisão ({emRevisao.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-3 sm:pb-4">
        <ScrollArea className="w-full">
          <div className="flex gap-2 sm:gap-3 pb-2">
            {emRevisao.map((cliente) => (
              <div
                key={cliente.id}
                className="flex-shrink-0 w-[240px] sm:w-[280px] p-2.5 sm:p-3 rounded-lg bg-warning/10 border border-warning/20"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-xs sm:text-sm truncate">{cliente.cliente_nome}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{cliente.produto}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] sm:text-xs text-warning font-medium">
                      {format(cliente.data_vencimento_mes_atual, 'dd/MM', { locale: ptBR })}
                    </p>
                    <p className="text-xs sm:text-sm font-semibold">
                      {formatCurrency(cliente.valor_parcela)}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 sm:h-8 text-[10px] sm:text-xs px-2 border-success text-success hover:bg-success hover:text-success-foreground"
                    onClick={() => handleConfirmar(cliente.id)}
                    disabled={confirmarPagamentoRevisao.isPending}
                  >
                    {confirmarPagamentoRevisao.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3 h-3 mr-0.5" />
                    )}
                    Pago
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 sm:h-8 text-[10px] sm:text-xs px-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleNaoPagou(cliente.id)}
                    disabled={marcarComoAtrasado.isPending}
                  >
                    {marcarComoAtrasado.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <XCircle className="w-3 h-3 mr-0.5" />
                    )}
                    Não pago
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}