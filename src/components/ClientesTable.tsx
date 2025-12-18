import { useState } from 'react';
import { ClienteCalculado } from '@/types/cliente';
import { useClientes } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Minus, History, Edit, Trash2, MoreHorizontal, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientesTableProps {
  clientes: ClienteCalculado[];
  onEdit: (cliente: ClienteCalculado) => void;
  onHistory: (cliente: ClienteCalculado) => void;
}

type FilterType = 'all' | 'em_dia' | 'atrasado';

export function ClientesTable({ clientes, onEdit, onHistory }: ClientesTableProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const { registrarPagamento, deleteCliente } = useClientes();

  const filteredClientes = clientes.filter((cliente) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'em_dia' && cliente.status === 'Em dia') ||
      (filter === 'atrasado' && cliente.status === 'Atrasado');

    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      cliente.cliente_nome.toLowerCase().includes(searchLower) ||
      (cliente.whatsapp && cliente.whatsapp.includes(search));

    return matchesFilter && matchesSearch;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handlePagamento = (clienteId: string, incremento: number) => {
    registrarPagamento.mutate({ clienteId, incremento });
  };

  const handleDelete = (cliente: ClienteCalculado) => {
    if (confirm(`Tem certeza que deseja excluir ${cliente.cliente_nome}?`)) {
      deleteCliente.mutate(cliente.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Todos ({clientes.length})
          </Button>
          <Button
            variant={filter === 'em_dia' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('em_dia')}
            className={filter === 'em_dia' ? 'bg-success hover:bg-success/90' : ''}
          >
            Em dia ({clientes.filter((c) => c.status === 'Em dia').length})
          </Button>
          <Button
            variant={filter === 'atrasado' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('atrasado')}
            className={filter === 'atrasado' ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            Atrasados ({clientes.filter((c) => c.status === 'Atrasado').length})
          </Button>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead>Cliente</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-center">Parcelas</TableHead>
              <TableHead className="text-right">Valor Parcela</TableHead>
              <TableHead className="text-right">A Receber</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum cliente encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredClientes.map((cliente) => (
                <TableRow
                  key={cliente.id}
                  className={cn(
                    'transition-colors',
                    cliente.status === 'Atrasado' && 'bg-destructive/5'
                  )}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{cliente.cliente_nome}</p>
                      {cliente.whatsapp && (
                        <p className="text-sm text-muted-foreground">{cliente.whatsapp}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{cliente.produto}</TableCell>
                  <TableCell className="text-center">
                    <span className="font-mono">
                      {cliente.parcelas_pagas}/{cliente.total_parcelas}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(cliente.valor_parcela)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(cliente.valor_a_receber)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={cliente.status === 'Em dia' ? 'default' : 'destructive'}
                      className={cn(
                        cliente.status === 'Em dia' && 'bg-success/20 text-success hover:bg-success/30'
                      )}
                    >
                      {cliente.status}
                      {cliente.dias_em_atraso > 0 && ` (${cliente.dias_em_atraso}d)`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-success/10 border-success/30 hover:bg-success/20 text-success"
                        onClick={() => handlePagamento(cliente.id, 1)}
                        disabled={cliente.parcelas_pagas >= cliente.total_parcelas || registrarPagamento.isPending}
                        title="+1 Parcela Paga"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePagamento(cliente.id, -1)}
                        disabled={cliente.parcelas_pagas <= 0 || registrarPagamento.isPending}
                        title="-1 Parcela"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onHistory(cliente)}>
                            <History className="w-4 h-4 mr-2" />
                            Ver Histórico
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(cliente)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(cliente)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}