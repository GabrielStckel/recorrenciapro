import { ClienteCalculado } from '@/types/cliente';
import { useClientes } from '@/hooks/useClientes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';

interface PagamentosEmRevisaoProps {
  clientes: ClienteCalculado[];
}

export function PagamentosEmRevisao({ clientes }: PagamentosEmRevisaoProps) {
  const { confirmarPagamentoRevisao, marcarComoAtrasado } = useClientes();
  const isMobile = useIsMobile();
  
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
        <CardContent className="p-4 text-center">
          <p className="text-success text-sm">✓ Nenhum pagamento pendente de revisão</p>
        </CardContent>
      </Card>
    );
  }

  const ClienteCard = ({ cliente }: { cliente: ClienteCalculado }) => (
    <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground text-sm truncate">{cliente.cliente_nome}</p>
        <p className="text-xs text-muted-foreground">{cliente.produto}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-warning">
          {format(cliente.data_vencimento_mes_atual, 'dd/MM', { locale: ptBR })}
        </p>
        <p className="text-sm font-semibold">
          {formatCurrency(cliente.valor_parcela)}
        </p>
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 border-success text-success hover:bg-success hover:text-success-foreground"
          onClick={() => handleConfirmar(cliente.id)}
          disabled={confirmarPagamentoRevisao.isPending}
          title="Confirmar pagamento"
        >
          {confirmarPagamentoRevisao.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => handleNaoPagou(cliente.id)}
          disabled={marcarComoAtrasado.isPending}
          title="Não pagou"
        >
          {marcarComoAtrasado.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );

  // Mobile: horizontal scroll with compact cards
  if (isMobile) {
    return (
      <Card className="glass border-warning/30">
        <CardHeader className="pb-2 px-4 pt-3">
          <CardTitle className="text-sm flex items-center gap-2 text-warning">
            <Clock className="w-4 h-4" />
            Em Revisão ({emRevisao.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {emRevisao.map((cliente) => (
                <div
                  key={cliente.id}
                  className="flex-shrink-0 w-[280px] p-3 rounded-lg bg-warning/10 border border-warning/20"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground text-sm truncate">{cliente.cliente_nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{cliente.produto}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-warning">
                        {format(cliente.data_vencimento_mes_atual, 'dd/MM', { locale: ptBR })}
                      </p>
                      <p className="text-sm font-semibold">
                        {formatCurrency(cliente.valor_parcela)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs border-success text-success hover:bg-success hover:text-success-foreground"
                      onClick={() => handleConfirmar(cliente.id)}
                      disabled={confirmarPagamentoRevisao.isPending}
                    >
                      {confirmarPagamentoRevisao.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      )}
                      Pago
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleNaoPagou(cliente.id)}
                      disabled={marcarComoAtrasado.isPending}
                    >
                      {marcarComoAtrasado.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1" />
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

  // Desktop: inline list with icon buttons
  return (
    <Card className="glass border-warning/30">
      <CardHeader className="pb-3 px-4">
        <CardTitle className="text-base flex items-center gap-2 text-warning">
          <Clock className="w-4 h-4" />
          Pagamentos em Revisão ({emRevisao.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-2">
          {emRevisao.map((cliente) => (
            <ClienteCard key={cliente.id} cliente={cliente} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}