import { useState } from 'react';
import { ClienteCalculado, StatusCliente } from '@/types/cliente';
import { useClientes } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Minus, History, Edit, Trash2, MoreHorizontal, Search, Clock, UserCheck, UserX, Pause, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientesTableProps {
  clientes: ClienteCalculado[];
  onEdit: (cliente: ClienteCalculado) => void;
  onHistory: (cliente: ClienteCalculado) => void;
  onMovimentos: (cliente: ClienteCalculado) => void;
}

type FilterType = 'all' | 'em_dia' | 'atrasado';
type StatusFilterType = 'all' | StatusCliente;

const statusConfig: Record<StatusCliente, { label: string; color: string; icon: typeof UserCheck }> = {
  ATIVO: { label: 'Ativo', color: 'bg-success/20 text-success border-success/30', icon: UserCheck },
  PAUSADO: { label: 'Pausado', color: 'bg-warning/20 text-warning border-warning/30', icon: Pause },
  CANCELADO: { label: 'Cancelado', color: 'bg-muted text-muted-foreground border-muted', icon: UserX },
  QUITADO: { label: 'Quitado', color: 'bg-info/20 text-info border-info/30', icon: CheckCircle },
};

export function ClientesTable({ clientes, onEdit, onHistory, onMovimentos }: ClientesTableProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [search, setSearch] = useState('');
  const { registrarPagamento, deleteCliente, updateCliente } = useClientes();

  const filteredClientes = clientes.filter((cliente) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'em_dia' && cliente.status === 'Em dia') ||
      (filter === 'atrasado' && cliente.status === 'Atrasado');

    const matchesStatusFilter =
      statusFilter === 'all' || cliente.status_cliente === statusFilter;

    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      cliente.cliente_nome.toLowerCase().includes(searchLower) ||
      (cliente.whatsapp && cliente.whatsapp.includes(search));

    return matchesFilter && matchesStatusFilter && matchesSearch;
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

  const handleStatusChange = (clienteId: string, newStatus: StatusCliente) => {
    updateCliente.mutate({ id: clienteId, status_cliente: newStatus });
  };

  const getStatusCounts = () => {
    return {
      ATIVO: clientes.filter((c) => c.status_cliente === 'ATIVO').length,
      PAUSADO: clientes.filter((c) => c.status_cliente === 'PAUSADO').length,
      CANCELADO: clientes.filter((c) => c.status_cliente === 'CANCELADO').length,
      QUITADO: clientes.filter((c) => c.status_cliente === 'QUITADO').length,
    };
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col gap-4">
        {/* Status Payment Filters */}
        <div className="flex flex-wrap gap-2">
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

        {/* Status Client Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              Todos Status
            </Button>
            <Button
              variant={statusFilter === 'ATIVO' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('ATIVO')}
              className={statusFilter === 'ATIVO' ? 'bg-success/20 text-success' : ''}
            >
              <UserCheck className="w-3 h-3 mr-1" />
              Ativos ({statusCounts.ATIVO})
            </Button>
            <Button
              variant={statusFilter === 'PAUSADO' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('PAUSADO')}
              className={statusFilter === 'PAUSADO' ? 'bg-warning/20 text-warning' : ''}
            >
              <Pause className="w-3 h-3 mr-1" />
              Pausados ({statusCounts.PAUSADO})
            </Button>
            <Button
              variant={statusFilter === 'CANCELADO' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('CANCELADO')}
            >
              <UserX className="w-3 h-3 mr-1" />
              Cancelados ({statusCounts.CANCELADO})
            </Button>
            <Button
              variant={statusFilter === 'QUITADO' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('QUITADO')}
              className={statusFilter === 'QUITADO' ? 'bg-info/20 text-info' : ''}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Quitados ({statusCounts.QUITADO})
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
              <TableHead className="text-center">Pagamento</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum cliente encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredClientes.map((cliente) => {
                const statusInfo = statusConfig[cliente.status_cliente] || statusConfig.ATIVO;
                const StatusIcon = statusInfo.icon;
                
                return (
                  <TableRow
                    key={cliente.id}
                    className={cn(
                      'transition-colors',
                      cliente.status === 'Atrasado' && 'bg-destructive/5',
                      cliente.status_cliente === 'CANCELADO' && 'opacity-60'
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
                    <TableCell className="text-center">
                      <Select
                        value={cliente.status_cliente}
                        onValueChange={(value: StatusCliente) => handleStatusChange(cliente.id, value)}
                      >
                        <SelectTrigger className={cn('w-[130px] h-7 text-xs border', statusInfo.color)}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ATIVO">
                            <div className="flex items-center gap-2">
                              <UserCheck className="w-3 h-3 text-success" />
                              Ativo
                            </div>
                          </SelectItem>
                          <SelectItem value="PAUSADO">
                            <div className="flex items-center gap-2">
                              <Pause className="w-3 h-3 text-warning" />
                              Pausado
                            </div>
                          </SelectItem>
                          <SelectItem value="CANCELADO">
                            <div className="flex items-center gap-2">
                              <UserX className="w-3 h-3 text-muted-foreground" />
                              Cancelado
                            </div>
                          </SelectItem>
                          <SelectItem value="QUITADO">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 text-info" />
                              Quitado
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
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
                            <DropdownMenuItem onClick={() => onMovimentos(cliente)}>
                              <Clock className="w-4 h-4 mr-2" />
                              Movimentos
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onHistory(cliente)}>
                              <History className="w-4 h-4 mr-2" />
                              Ver Histórico
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(cliente)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
