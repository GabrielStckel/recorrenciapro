import { useState } from 'react';
import { ClienteCalculado, StatusCliente, StatusPagamento } from '@/types/cliente';
import { useClientes } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Minus, History, Edit, Trash2, MoreHorizontal, Search, Clock, UserCheck, UserX, Pause, CheckCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientesTableProps {
  clientes: ClienteCalculado[];
  onEdit: (cliente: ClienteCalculado) => void;
  onHistory: (cliente: ClienteCalculado) => void;
  onMovimentos: (cliente: ClienteCalculado) => void;
}

type StatusFilterOption = 'all' | 'em_dia' | 'em_revisao' | 'atrasado' | 'ATIVO' | 'PAUSADO' | 'CANCELADO' | 'QUITADO';

const statusFilterOptions: { value: StatusFilterOption; label: string; color?: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'em_dia', label: 'Em dia', color: 'text-success' },
  { value: 'em_revisao', label: 'Em revisão', color: 'text-warning' },
  { value: 'atrasado', label: 'Atrasado', color: 'text-destructive' },
  { value: 'ATIVO', label: 'Ativo', color: 'text-success' },
  { value: 'PAUSADO', label: 'Pausado', color: 'text-warning' },
  { value: 'CANCELADO', label: 'Cancelado', color: 'text-muted-foreground' },
  { value: 'QUITADO', label: 'Quitado', color: 'text-info' },
];

const statusPagamentoConfig: Record<StatusPagamento, { label: string; color: string }> = {
  'Em dia': { label: 'Em dia', color: 'bg-success/20 text-success hover:bg-success/30' },
  'Em revisão': { label: 'Em revisão', color: 'bg-warning/20 text-warning hover:bg-warning/30' },
  'Atrasado': { label: 'Atrasado', color: 'bg-destructive/20 text-destructive hover:bg-destructive/30' },
};

const statusConfig: Record<StatusCliente, { label: string; color: string; icon: typeof UserCheck }> = {
  ATIVO: { label: 'Ativo', color: 'bg-success/20 text-success border-success/30', icon: UserCheck },
  PAUSADO: { label: 'Pausado', color: 'bg-warning/20 text-warning border-warning/30', icon: Pause },
  CANCELADO: { label: 'Cancelado', color: 'bg-muted text-muted-foreground border-muted', icon: UserX },
  QUITADO: { label: 'Quitado', color: 'bg-info/20 text-info border-info/30', icon: CheckCircle },
};

export function ClientesTable({ clientes, onEdit, onHistory, onMovimentos }: ClientesTableProps) {
  const [selectedFilters, setSelectedFilters] = useState<StatusFilterOption[]>([]);
  const [search, setSearch] = useState('');
  const { registrarPagamento, deleteCliente, updateCliente } = useClientes();

  const handleFilterChange = (value: StatusFilterOption, checked: boolean) => {
    if (value === 'all') {
      setSelectedFilters([]);
      return;
    }
    
    if (checked) {
      setSelectedFilters((prev) => prev.filter((f) => f !== 'all').concat(value));
    } else {
      setSelectedFilters((prev) => prev.filter((f) => f !== value));
    }
  };

  const isAllSelected = selectedFilters.length === 0;

  const filteredClientes = clientes.filter((cliente) => {
    if (isAllSelected) {
      const searchLower = search.toLowerCase();
      return (
        !search ||
        cliente.cliente_nome.toLowerCase().includes(searchLower) ||
        (cliente.whatsapp && cliente.whatsapp.includes(search))
      );
    }

    const matchesPaymentStatus = 
      selectedFilters.includes('em_dia') && cliente.status === 'Em dia' ||
      selectedFilters.includes('em_revisao') && cliente.status === 'Em revisão' ||
      selectedFilters.includes('atrasado') && cliente.status === 'Atrasado';

    const matchesClientStatus =
      selectedFilters.includes('ATIVO') && cliente.status_cliente === 'ATIVO' ||
      selectedFilters.includes('PAUSADO') && cliente.status_cliente === 'PAUSADO' ||
      selectedFilters.includes('CANCELADO') && cliente.status_cliente === 'CANCELADO' ||
      selectedFilters.includes('QUITADO') && cliente.status_cliente === 'QUITADO';

    const matchesFilter = matchesPaymentStatus || matchesClientStatus;

    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      cliente.cliente_nome.toLowerCase().includes(searchLower) ||
      (cliente.whatsapp && cliente.whatsapp.includes(search));

    return matchesFilter && matchesSearch;
  });

  const getFilterLabel = () => {
    if (isAllSelected) return 'Todos os status';
    const labels = selectedFilters.map((f) => 
      statusFilterOptions.find((opt) => opt.value === f)?.label || f
    );
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return labels.join(', ');
    return `${labels.length} selecionados`;
  };

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

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Status Multi-Select Dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[180px] justify-between">
              <span className="truncate">Status: {getFilterLabel()}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-2 bg-popover" align="start">
            <div className="space-y-1">
              {statusFilterOptions.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer"
                  onClick={() => handleFilterChange(option.value, !selectedFilters.includes(option.value))}
                >
                  <Checkbox
                    id={option.value}
                    checked={option.value === 'all' ? isAllSelected : selectedFilters.includes(option.value)}
                    onCheckedChange={(checked) => handleFilterChange(option.value, !!checked)}
                  />
                  <label
                    htmlFor={option.value}
                    className={cn('text-sm cursor-pointer flex-1', option.color)}
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Results Count */}
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filteredClientes.length} de {clientes.length} clientes
        </span>
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
                      {(() => {
                        const statusPagamento = statusPagamentoConfig[cliente.status];
                        return (
                          <Badge
                            variant="outline"
                            className={cn('border', statusPagamento.color)}
                          >
                            {cliente.status}
                            {cliente.dias_em_atraso > 0 && cliente.status !== 'Em dia' && ` (${cliente.dias_em_atraso}d)`}
                          </Badge>
                        );
                      })()}
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
