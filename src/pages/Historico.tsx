import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useClientes } from '@/hooks/useClientes';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Loader2, 
  Search, 
  ArrowUp, 
  ArrowDown, 
  Calendar,
  Clock,
  Filter,
  ChevronDown,
  X
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Movimento {
  id: string;
  cliente_id: string;
  tipo: string;
  delta_parcelas: number;
  parcelas_antes: number;
  parcelas_depois: number;
  observacao: string | null;
  data_evento: string;
  created_at: string;
}

type TipoFilter = 'todos' | 'INCREMENTO' | 'DECREMENTO';
type PeriodoFilter = 'todos' | 'hoje' | '7dias' | '30dias' | 'mes_atual';

export default function Historico() {
  const { user } = useAuth();
  const { clientes } = useClientes();
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos');
  const [clienteFilter, setClienteFilter] = useState<string>('todos');
  const [periodoFilter, setPeriodoFilter] = useState<PeriodoFilter>('todos');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: movimentos = [], isLoading } = useQuery({
    queryKey: ['all-movimentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('movimentos_parcelas')
        .select('*')
        .order('data_evento', { ascending: false });
      
      if (error) throw error;
      return data as Movimento[];
    },
    enabled: !!user,
  });

  const clientesMap = useMemo(() => {
    const map = new Map<string, string>();
    clientes.forEach(c => map.set(c.id, c.cliente_nome));
    return map;
  }, [clientes]);

  const filteredMovimentos = useMemo(() => {
    return movimentos.filter(mov => {
      // Filtro de busca por nome do cliente
      if (search) {
        const clienteNome = clientesMap.get(mov.cliente_id) || '';
        if (!clienteNome.toLowerCase().includes(search.toLowerCase())) {
          return false;
        }
      }

      // Filtro de tipo
      if (tipoFilter !== 'todos' && mov.tipo !== tipoFilter) {
        return false;
      }

      // Filtro de cliente
      if (clienteFilter !== 'todos' && mov.cliente_id !== clienteFilter) {
        return false;
      }

      // Filtro de período
      if (periodoFilter !== 'todos') {
        const dataEvento = parseISO(mov.data_evento);
        const hoje = new Date();
        
        switch (periodoFilter) {
          case 'hoje':
            if (format(dataEvento, 'yyyy-MM-dd') !== format(hoje, 'yyyy-MM-dd')) {
              return false;
            }
            break;
          case '7dias':
            if (!isWithinInterval(dataEvento, { start: subDays(hoje, 7), end: hoje })) {
              return false;
            }
            break;
          case '30dias':
            if (!isWithinInterval(dataEvento, { start: subDays(hoje, 30), end: hoje })) {
              return false;
            }
            break;
          case 'mes_atual':
            if (!isWithinInterval(dataEvento, { 
              start: startOfMonth(hoje), 
              end: endOfMonth(hoje) 
            })) {
              return false;
            }
            break;
        }
      }

      return true;
    });
  }, [movimentos, search, tipoFilter, clienteFilter, periodoFilter, clientesMap]);

  const getActiveFiltersCount = () => {
    let count = 0;
    if (tipoFilter !== 'todos') count++;
    if (clienteFilter !== 'todos') count++;
    if (periodoFilter !== 'todos') count++;
    return count;
  };

  const clearAllFilters = () => {
    setTipoFilter('todos');
    setClienteFilter('todos');
    setPeriodoFilter('todos');
  };

  const formatDateTime = (dateStr: string) => {
    const date = parseISO(dateStr);
    return format(date, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
  };

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const formatTime = (dateStr: string) => {
    const date = parseISO(dateStr);
    return format(date, "HH:mm:ss", { locale: ptBR });
  };

  // Estatísticas
  const stats = useMemo(() => {
    const incrementos = filteredMovimentos.filter(m => m.tipo === 'INCREMENTO').length;
    const decrementos = filteredMovimentos.filter(m => m.tipo === 'DECREMENTO').length;
    return { incrementos, decrementos, total: filteredMovimentos.length };
  }, [filteredMovimentos]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Histórico de Movimentos</h1>
            <p className="text-muted-foreground">
              Registro completo de todas as alterações em pagamentos
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total de registros</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <ArrowUp className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">{stats.incrementos}</p>
                  <p className="text-sm text-muted-foreground">Pagamentos registrados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <ArrowDown className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{stats.decrementos}</p>
                  <p className="text-sm text-muted-foreground">Estornos/Correções</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
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
            <PopoverContent className="w-[280px] p-4" align="start">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tipo de Movimento</Label>
                  <Select value={tipoFilter} onValueChange={(v: TipoFilter) => setTipoFilter(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="INCREMENTO">
                        <span className="text-success">Pagamentos (+1)</span>
                      </SelectItem>
                      <SelectItem value="DECREMENTO">
                        <span className="text-destructive">Estornos (-1)</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cliente</Label>
                  <Select value={clienteFilter} onValueChange={setClienteFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {clientes.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.cliente_nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Período</Label>
                  <Select value={periodoFilter} onValueChange={(v: PeriodoFilter) => setPeriodoFilter(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todo período</SelectItem>
                      <SelectItem value="hoje">Hoje</SelectItem>
                      <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                      <SelectItem value="30dias">Últimos 30 dias</SelectItem>
                      <SelectItem value="mes_atual">Este mês</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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

          {/* Active filter badges */}
          {getActiveFiltersCount() > 0 && (
            <div className="flex flex-wrap gap-2">
              {tipoFilter !== 'todos' && (
                <Badge variant="secondary" className="gap-1">
                  {tipoFilter === 'INCREMENTO' ? 'Pagamentos' : 'Estornos'}
                  <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => setTipoFilter('todos')} />
                </Badge>
              )}
              {clienteFilter !== 'todos' && (
                <Badge variant="secondary" className="gap-1">
                  {clientesMap.get(clienteFilter)}
                  <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => setClienteFilter('todos')} />
                </Badge>
              )}
              {periodoFilter !== 'todos' && (
                <Badge variant="secondary" className="gap-1">
                  {periodoFilter === 'hoje' ? 'Hoje' : 
                   periodoFilter === '7dias' ? '7 dias' : 
                   periodoFilter === '30dias' ? '30 dias' : 'Este mês'}
                  <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => setPeriodoFilter('todos')} />
                </Badge>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {filteredMovimentos.length} registros
          </span>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead>Data</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Ação</TableHead>
                <TableHead className="text-center">Parcelas</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovimentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredMovimentos.map((mov) => (
                  <TableRow key={mov.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {formatDate(mov.data_evento)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{formatTime(mov.data_evento)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {clientesMap.get(mov.cliente_id) || 'Cliente não encontrado'}
                    </TableCell>
                    <TableCell className="text-center">
                      {mov.tipo === 'INCREMENTO' ? (
                        <Badge className="bg-success/20 text-success border-success/30">
                          <ArrowUp className="w-3 h-3 mr-1" />
                          +1 Parcela
                        </Badge>
                      ) : (
                        <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                          <ArrowDown className="w-3 h-3 mr-1" />
                          -1 Parcela
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-sm">
                        {mov.parcelas_antes} → {mov.parcelas_depois}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {mov.observacao || '-'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
