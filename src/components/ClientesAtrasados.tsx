import { ClienteCalculado } from '@/types/cliente';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
                    Clientes em Atraso
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {atrasados.length} {atrasados.length === 1 ? 'cliente' : 'clientes'}
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
              {atrasados.map((cliente) => (
                <div
                  key={cliente.id}
                  className="group p-2.5 lg:p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 hover:border-destructive/40 hover:bg-destructive/15 transition-all duration-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm lg:text-base font-medium text-foreground truncate">
                        {hideNames ? '••••••••' : cliente.cliente_nome}
                      </p>
                      <p className="text-xs lg:text-sm text-muted-foreground truncate">{cliente.produto}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge variant="destructive" className="text-[10px] lg:text-xs px-1.5 lg:px-2 py-0 lg:py-0.5">
                        {cliente.dias_em_atraso}d
                      </Badge>
                      <p className="text-sm lg:text-base font-semibold text-foreground">
                        {formatCurrency(cliente.valor_parcela)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}