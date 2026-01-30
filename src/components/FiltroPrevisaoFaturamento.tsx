import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ClienteCalculado } from '@/types/cliente';
import { CalendarIcon, TrendingUp, Clock, ChevronDown } from 'lucide-react';
import { format, addDays, differenceInDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface FiltroPrevisaoFaturamentoProps {
  clientes: ClienteCalculado[];
  hideValues?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type FilterMode = 'dias' | 'data';

export function FiltroPrevisaoFaturamento({ clientes, hideValues = false, isOpen = false, onOpenChange }: FiltroPrevisaoFaturamentoProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>('dias');
  const [diasFiltro, setDiasFiltro] = useState<number>(30);
  const [dataFiltro, setDataFiltro] = useState<Date | undefined>(addDays(new Date(), 30));
  const hoje = startOfDay(new Date());

  // Calculate the target date based on filter mode
  const dataAlvo = useMemo(() => {
    if (filterMode === 'dias') {
      return addDays(hoje, diasFiltro);
    }
    return dataFiltro || addDays(hoje, 30);
  }, [filterMode, diasFiltro, dataFiltro, hoje]);

  // Calculate forecast up to the target date
  const previsao = useMemo(() => {
    let totalPrevisao = 0;
    let clientesComVencimento = 0;

    clientes.forEach((cliente) => {
      if (cliente.status_cliente !== 'ATIVO') return;

      const valorParcela = cliente.valor_parcela;
      const totalParcelas = cliente.total_parcelas;
      const parcelasPagas = cliente.parcelas_pagas;

      // Parse data_inicio
      const [year, month] = cliente.data_inicio.split('-').map(Number);
      const dataInicio = new Date(year, month - 1, 1);

      // Calculate due dates for each remaining parcel
      const getDueDate = (year: number, month: number, diaVenc: number) => {
        const lastDay = new Date(year, month + 1, 0).getDate();
        const dia = Math.min(diaVenc, lastDay);
        return new Date(year, month, dia);
      };

      const primeiroPagamento = getDueDate(dataInicio.getFullYear(), dataInicio.getMonth(), cliente.dia_vencimento);

      let clienteContado = false;

      for (let i = 0; i < totalParcelas; i++) {
        const numeroParcela = i + 1;
        
        // Skip already paid parcels
        if (numeroParcela <= parcelasPagas) continue;

        const dueDate = getDueDate(
          primeiroPagamento.getFullYear(),
          primeiroPagamento.getMonth() + i,
          cliente.dia_vencimento
        );

        // Check if due date is within range (from today to target date)
        if (!isBefore(dueDate, hoje) && !isAfter(startOfDay(dueDate), startOfDay(dataAlvo))) {
          totalPrevisao += valorParcela;
          if (!clienteContado) {
            clientesComVencimento++;
            clienteContado = true;
          }
        }
      }
    });

    return { total: totalPrevisao, clientes: clientesComVencimento };
  }, [clientes, dataAlvo, hoje]);

  const diasRestantes = differenceInDays(dataAlvo, hoje);

  const formatCurrency = (value: number) => {
    if (hideValues) return '••••••';
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const presetDias = [7, 15, 30, 60, 90];

  return (
    <Card className="glass">
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left group">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Previsão por Período</CardTitle>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          <p className="text-xs text-muted-foreground">Atualizado em tempo real</p>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Filter Mode Tabs */}
            <Tabs value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
              <TabsList className="h-9 w-full">
                <TabsTrigger value="dias" className="flex-1 gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Por Dias
                </TabsTrigger>
                <TabsTrigger value="data" className="flex-1 gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  Até Data
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filter Controls */}
            {filterMode === 'dias' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={diasFiltro}
                    onChange={(e) => setDiasFiltro(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
                    className="w-20 text-center"
                  />
                  <span className="text-sm text-muted-foreground">dias a partir de hoje</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {presetDias.map((dias) => (
                    <Button
                      key={dias}
                      variant={diasFiltro === dias ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDiasFiltro(dias)}
                      className="h-7 px-3 text-xs"
                    >
                      {dias}d
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dataFiltro && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataFiltro ? (
                        format(dataFiltro, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecione uma data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataFiltro}
                      onSelect={setDataFiltro}
                      disabled={(date) => date < hoje}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Results */}
            <div className="pt-3 border-t border-border">
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">
                  Previsão para os próximos {diasRestantes} dias
                </p>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(previsao.total)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {previsao.clientes} cliente{previsao.clientes !== 1 ? 's' : ''} com vencimento no período
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Até {format(dataAlvo, "dd/MM/yyyy")}
                </p>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
