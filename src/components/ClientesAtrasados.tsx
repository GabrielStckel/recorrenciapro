import { ClienteCalculado } from '@/types/cliente';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface ClientesAtrasadosProps {
  clientes: ClienteCalculado[];
  hideValues?: boolean;
}

export function ClientesAtrasados({ clientes, hideValues = false }: ClientesAtrasadosProps) {
  const atrasados = clientes.filter((c) => c.status === 'Atrasado');

  const formatCurrency = (value: number) => {
    if (hideValues) return '••••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (atrasados.length === 0) {
    return (
      <Card className="glass border-success/20">
        <CardContent className="p-6 text-center">
          <p className="text-success">✓ Nenhum cliente em atraso</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          Clientes em Atraso ({atrasados.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {atrasados.map((cliente) => (
            <div
              key={cliente.id}
              className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
            >
              <div className="space-y-1">
                <p className="font-medium text-foreground">{cliente.cliente_nome}</p>
                <p className="text-sm text-muted-foreground">{cliente.produto}</p>
              </div>
              <div className="text-right space-y-1">
                <Badge variant="destructive">
                  {cliente.dias_em_atraso} dias
                </Badge>
                <p className="text-sm font-medium text-destructive">
                  {formatCurrency(cliente.valor_parcela)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}