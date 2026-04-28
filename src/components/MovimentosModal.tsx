import { useMovimentos } from '@/hooks/useMovimentos';
import { ClienteCalculado } from '@/types/cliente';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Minus, Settings, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MovimentosModalProps {
  cliente: ClienteCalculado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MovimentosModal({ cliente, open, onOpenChange }: MovimentosModalProps) {
  const { data: movimentos = [], isLoading } = useMovimentos(cliente?.id);

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'INCREMENTO':
        return <Plus className="w-4 h-4 text-success" />;
      case 'DECREMENTO':
        return <Minus className="w-4 h-4 text-destructive" />;
      default:
        return <Settings className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTipoLabel = (tipo: string, delta: number, antes: number, depois: number) => {
    const sinal = delta > 0 ? '+' : '';
    switch (tipo) {
      case 'INCREMENTO':
        return `${sinal}${delta} parcela (de ${antes} para ${depois})`;
      case 'DECREMENTO':
        return `${sinal}${delta} parcela (de ${antes} para ${depois})`;
      case 'AJUSTE':
        return `Ajuste de ${antes} para ${depois}`;
      default:
        return tipo;
    }
  };

  const getBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case 'INCREMENTO':
        return 'default';
      case 'DECREMENTO':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Histórico de Movimentos
          </DialogTitle>
          {cliente && (
            <p className="text-sm text-muted-foreground">
              Cliente: <span className="font-medium text-foreground">{cliente.cliente_nome}</span>
            </p>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : movimentos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum movimento registrado</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {movimentos.map((movimento) => (
                <div
                  key={movimento.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      {getIcon(movimento.tipo)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getBadgeVariant(movimento.tipo)} className="text-xs">
                        {movimento.tipo}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">
                      {getTipoLabel(
                        movimento.tipo,
                        movimento.delta_parcelas,
                        movimento.parcelas_antes,
                        movimento.parcelas_depois
                      )}
                    </p>
                    {movimento.observacao && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        "{movimento.observacao}"
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(movimento.data_evento), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                      {movimento.registrado_por && (
                        <span className="ml-1">• por <span className="font-medium text-foreground">{movimento.registrado_por}</span></span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
