import { ClienteCalculado } from '@/types/cliente';
import { useClientes } from '@/hooks/useClientes';
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
    return null;
  }

  return (
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
      <CardContent className="pt-0 px-3 sm:px-6">
        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3">
          {emRevisao.map((cliente) => (
            <div
              key={cliente.id}
              className="group p-3 sm:p-4 rounded-xl bg-warning/10 border border-warning/20 hover:border-warning/40 hover:bg-warning/15 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground text-sm sm:text-base truncate">{cliente.cliente_nome}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{cliente.produto}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] sm:text-xs text-warning">
                    Venc. {format(cliente.data_vencimento_mes_atual, 'dd/MM', { locale: ptBR })}
                  </p>
                  <p className="text-base sm:text-lg font-semibold text-foreground">
                    {formatCurrency(cliente.valor_parcela)}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-1.5 sm:gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-8 sm:h-9 text-xs sm:text-sm bg-success/10 text-success border border-success/20 hover:bg-success hover:text-success-foreground transition-colors px-2 sm:px-3"
                  onClick={() => handleConfirmar(cliente.id)}
                  disabled={confirmarPagamentoRevisao.isPending}
                >
                  {confirmarPagamentoRevisao.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                      <span>Pagou</span>
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 sm:h-9 text-xs sm:text-sm bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition-colors px-2 sm:px-3"
                  onClick={() => handleNaoPagou(cliente.id)}
                  disabled={marcarComoAtrasado.isPending}
                >
                  {marcarComoAtrasado.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
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
  );
}