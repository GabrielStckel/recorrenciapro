import { ClienteCalculado } from '@/types/cliente';
import { useClientes } from '@/hooks/useClientes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    return (
      <Card className="glass border-success/20">
        <CardContent className="p-6 text-center">
          <p className="text-success">✓ Nenhum pagamento pendente de revisão</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-warning/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-warning">
          <Clock className="w-5 h-5" />
          Pagamentos em Revisão ({emRevisao.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {emRevisao.map((cliente) => (
            <div
              key={cliente.id}
              className="p-4 rounded-lg bg-warning/10 border border-warning/20 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{cliente.cliente_nome}</p>
                  <p className="text-sm text-muted-foreground">{cliente.produto}</p>
                </div>
                <div className="text-right space-y-1">
                  <Badge variant="outline" className="border-warning text-warning">
                    {format(cliente.data_vencimento_mes_atual, 'dd/MM/yyyy', { locale: ptBR })}
                  </Badge>
                  <p className="text-sm font-medium">
                    {formatCurrency(cliente.valor_parcela)}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-success text-success hover:bg-success hover:text-success-foreground"
                  onClick={() => handleConfirmar(cliente.id)}
                  disabled={confirmarPagamentoRevisao.isPending}
                >
                  {confirmarPagamentoRevisao.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-1" />
                  )}
                  Confirmar pagamento
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleNaoPagou(cliente.id)}
                  disabled={marcarComoAtrasado.isPending}
                >
                  {marcarComoAtrasado.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-1" />
                  )}
                  Não pagou
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}