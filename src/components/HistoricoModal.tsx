import { useHistorico } from '@/hooks/useClientes';
import { ClienteCalculado } from '@/types/cliente';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

interface HistoricoModalProps {
  open: boolean;
  onClose: () => void;
  cliente: ClienteCalculado | null;
}

export function HistoricoModal({ open, onClose, cliente }: HistoricoModalProps) {
  const { data: historico, isLoading } = useHistorico(cliente?.id);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Histórico de Pagamentos
            {cliente && (
              <span className="text-muted-foreground font-normal ml-2">
                - {cliente.cliente_nome}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !historico || historico.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum pagamento registrado
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Parcela</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Registrado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((pagamento) => (
                  <TableRow key={pagamento.id}>
                    <TableCell className="text-sm">
                      {formatDate(pagamento.data_pagamento)}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {pagamento.numero_parcela}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(pagamento.valor_pago)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {pagamento.registrado_por || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}