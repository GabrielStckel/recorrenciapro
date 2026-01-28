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
    return null;
  }

  return (
    <Card className="glass border-destructive/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-4 h-4" />
          Clientes em Atraso
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {atrasados.length} {atrasados.length === 1 ? 'cliente' : 'clientes'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {atrasados.map((cliente) => (
            <div
              key={cliente.id}
              className="group glass-subtle p-4 rounded-xl border border-destructive/10 hover:border-destructive/30 transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1 pr-3">
                  <p className="font-medium text-foreground truncate">{cliente.cliente_nome}</p>
                  <p className="text-sm text-muted-foreground truncate">{cliente.produto}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <Badge variant="destructive" className="mb-1">
                    {cliente.dias_em_atraso} dias
                  </Badge>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(cliente.valor_parcela)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}