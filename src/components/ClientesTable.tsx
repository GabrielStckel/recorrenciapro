import { useState } from 'react';
import { ClienteCalculado, StatusCliente, StatusPagamento } from '@/types/cliente';
import { useClientes } from '@/hooks/useClientes';
import { useProdutos } from '@/hooks/useProdutos';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Minus, History, Edit, Trash2, MoreHorizontal, Search, Clock, UserCheck, UserX, Pause, CheckCircle, ChevronDown, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientesTableProps {
  clientes: ClienteCalculado[];
  onEdit: (cliente: ClienteCalculado) => void;
  onHistory: (cliente: ClienteCalculado) => void;
  onMovimentos: (cliente: ClienteCalculado) => void;
  hideValues?: boolean;
}

type StatusPagamentoFilter = 'todos' | 'em_dia' | 'em_revisao' | 'atrasado' | 'pagar_este_mes';
type StatusClienteFilter = 'todos' | 'ativo' | 'pausado' | 'cancelado' | 'quitado';

const statusPagamentoFilterOptions: { value: StatusPagamentoFilter; label: string; color?: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'pagar_este_mes', label: 'Pagar este mês', color: 'text-info' },
  { value: 'em_dia', label: 'Em dia', color: 'text-success' },
  { value: 'em_revisao', label: 'Em revisão', color: 'text-warning' },
  { value: 'atrasado', label: 'Atrasado', color: 'text-destructive' },
];

const statusClienteFilterOptions: { value: StatusClienteFilter; label: string; color?: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativo', label: 'Ativo', color: 'text-success' },
  { value: 'pausado', label: 'Pausado', color: 'text-warning' },
  { value: 'cancelado', label: 'Cancelado', color: 'text-muted-foreground' },
  { value: 'quitado', label: 'Quitado', color: 'text-info' },
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

export function ClientesTable({ clientes, onEdit, onHistory, onMovimentos, hideValues = false }: ClientesTableProps) {
  const [statusPagamentoFilter, setStatusPagamentoFilter] = useState<StatusPagamentoFilter>('todos');
  const [statusClienteFilter, setStatusClienteFilter] = useState<StatusClienteFilter>('todos');
  const [produtoFilter, setProdutoFilter] = useState<string>('todos');
  const [filtersPopoverOpen, setFiltersPopoverOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { registrarPagamento, deleteCliente, updateCliente } = useClientes();
  const { produtos } = useProdutos();

  const formatCurrency = (value: number) => {
    if (hideValues) return '••••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const parseDateOnlyISO = (dateStr: string): Date => {
    const [ano, mes, dia] = dateStr.split('-').map(Number);
    return new Date(ano, mes - 1, dia);
  };

  const getDueDateClamped = (year: number, month: number, diaVencimento: number): Date => {
    const base = new Date(year, month, 1);
    const y = base.getFullYear();
    const m = base.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const dia = Math.min(Math.max(diaVencimento, 1), lastDay);
    return new Date(y, m, dia);
  };

  const getPrimeiroVencimento = (cliente: ClienteCalculado): Date => {
    const inicio = parseDateOnlyISO(cliente.data_inicio);
    const vencNoMesInicio = getDueDateClamped(inicio.getFullYear(), inicio.getMonth(), cliente.dia_vencimento);

    return inicio.getTime() <= vencNoMesInicio.getTime()
      ? vencNoMesInicio
      : getDueDateClamped(inicio.getFullYear(), inicio.getMonth() + 1, cliente.dia_vencimento);
  };

  const getProximoVencimento = (cliente: ClienteCalculado): Date | null => {
    if (cliente.status_cliente !== 'ATIVO') return null;
    if (cliente.parcelas_pendentes <= 0) return null;

    const primeiro = getPrimeiroVencimento(cliente);
    return getDueDateClamped(primeiro.getFullYear(), primeiro.getMonth() + cliente.parcelas_pagas, cliente.dia_vencimento);
  };

  const filteredClientes = clientes.filter((cliente) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      cliente.cliente_nome.toLowerCase().includes(searchLower) ||
      (cliente.whatsapp && cliente.whatsapp.includes(search));

    if (!matchesSearch) return false;

    // Filtro de produto
    if (produtoFilter !== 'todos' && cliente.produto !== produtoFilter) {
      return false;
    }

    if (statusPagamentoFilter !== 'todos') {
      if (statusPagamentoFilter === 'pagar_este_mes') {
        // Mostrar clientes que precisam pagar: atrasados OU com vencimento este mês
        if (cliente.status_cliente !== 'ATIVO') return false;
        if (cliente.parcelas_pendentes <= 0) return false;

        // Se está atrasado, deve aparecer
        if (cliente.status === 'Atrasado' || cliente.status === 'Em revisão') {
          return true;
        }

        // Se tem vencimento este mês, também deve aparecer
        const hoje = new Date();
        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();

        const vencimento = getProximoVencimento(cliente);
        if (!vencimento) return false;

        const venceEsteMes = vencimento.getMonth() === mesAtual && vencimento.getFullYear() === anoAtual;
        if (!venceEsteMes) return false;
      } else {
        const statusMap: Record<Exclude<StatusPagamentoFilter, 'todos' | 'pagar_este_mes'>, StatusPagamento> = {
          'em_dia': 'Em dia',
          'em_revisao': 'Em revisão',
          'atrasado': 'Atrasado',
        };
        if (cliente.status !== statusMap[statusPagamentoFilter]) return false;
      }
    }

    if (statusClienteFilter !== 'todos') {
      const statusMap: Record<StatusClienteFilter, string> = {
        'todos': '',
        'ativo': 'ATIVO',
        'pausado': 'PAUSADO',
        'cancelado': 'CANCELADO',
        'quitado': 'QUITADO',
      };
      if (cliente.status_cliente !== statusMap[statusClienteFilter]) return false;
    }

    return true;
  });

  const getActiveFiltersCount = () => {
    let count = 0;
    if (statusPagamentoFilter !== 'todos') count++;
    if (statusClienteFilter !== 'todos') count++;
    if (produtoFilter !== 'todos') count++;
    return count;
  };

  const clearAllFilters = () => {
    setStatusPagamentoFilter('todos');
    setStatusClienteFilter('todos');
    setProdutoFilter('todos');
  };

  // Cálculos de resumo dos clientes filtrados
  const totalParcelas = filteredClientes.reduce((acc, c) => acc + c.valor_parcela, 0);
  const totalEmAtraso = filteredClientes
    .filter((c) => c.status === 'Atrasado' || c.status === 'Em revisão')
    .reduce((acc, c) => acc + c.valor_parcela, 0);

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
        {/* Filtros agrupados */}
        <Popover open={filtersPopoverOpen} onOpenChange={setFiltersPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[120px] justify-between gap-2">
              <Filter className="h-4 w-4" />
              <span>Filtros</span>
              {getActiveFiltersCount() > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {getActiveFiltersCount()}
                </Badge>
              )}
              <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-4 bg-popover border border-border z-50" align="start">
            <div className="space-y-4">
              {/* Filtro de Pagamento */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status Pagamento</Label>
                <Select value={statusPagamentoFilter} onValueChange={(v: StatusPagamentoFilter) => setStatusPagamentoFilter(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusPagamentoFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={option.color}>{option.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro de Status Cliente */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status Cliente</Label>
                <Select value={statusClienteFilter} onValueChange={(v: StatusClienteFilter) => setStatusClienteFilter(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusClienteFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={option.color}>{option.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro de Produto */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Produto</Label>
                <Select value={produtoFilter} onValueChange={setProdutoFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.nome}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Botão limpar filtros */}
              {getActiveFiltersCount() > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={clearAllFilters}
                >
                  <X className="w-4 h-4 mr-2" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Badges dos filtros ativos */}
        {getActiveFiltersCount() > 0 && (
          <div className="flex flex-wrap gap-2">
            {statusPagamentoFilter !== 'todos' && (
              <Badge variant="secondary" className="gap-1">
                {statusPagamentoFilterOptions.find(o => o.value === statusPagamentoFilter)?.label}
                <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => setStatusPagamentoFilter('todos')} />
              </Badge>
            )}
            {statusClienteFilter !== 'todos' && (
              <Badge variant="secondary" className="gap-1">
                {statusClienteFilterOptions.find(o => o.value === statusClienteFilter)?.label}
                <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => setStatusClienteFilter('todos')} />
              </Badge>
            )}
            {produtoFilter !== 'todos' && (
              <Badge variant="secondary" className="gap-1">
                {produtoFilter}
                <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => setProdutoFilter('todos')} />
              </Badge>
            )}
          </div>
        )}

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

        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filteredClientes.length} de {clientes.length} clientes
        </span>
      </div>

      {/* Summary Box - only for "Pagar este mês" filter */}
      {statusPagamentoFilter === 'pagar_este_mes' && (
        <div className="flex flex-wrap gap-4 p-4 rounded-lg border border-border bg-card/50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total parcelas:</span>
            <span className="font-semibold text-foreground">{formatCurrency(totalParcelas)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Valor em atraso:</span>
            <span className="font-semibold text-destructive">{formatCurrency(totalEmAtraso)}</span>
          </div>
        </div>
      )}

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
                      <div className="flex flex-col items-center gap-1">
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
                        <span className="text-xs text-muted-foreground">
                          {(() => {
                            const vencimento = getProximoVencimento(cliente);
                            if (!vencimento) return '-';
                            const dataFmt = vencimento.toLocaleDateString('pt-BR');

                            // Se estiver atrasado ou em revisão, mostrar somente a data que deveria ter sido paga
                            if (cliente.status === 'Atrasado' || cliente.status === 'Em revisão') {
                              return dataFmt;
                            }

                            return `Próximo: ${dataFmt}`;
                          })()}
                        </span>
                      </div>
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
