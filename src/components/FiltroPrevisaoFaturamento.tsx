import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ClienteCalculado } from '@/types/cliente';
import { CalendarIcon, TrendingUp, Clock } from 'lucide-react';
import { format, addDays, differenceInDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface FiltroPrevisaoFaturamentoProps {
  clientes: ClienteCalculado[];
  hideValues?: boolean;
}

type FilterMode = 'dias' | 'data';

interface CategoriasFiltro {
  aPagar: boolean;
  emRevisao: boolean;
  emAtraso: boolean;
  incluirAcumulado: boolean;
}

export function FiltroPrevisaoFaturamento({ clientes, hideValues = false }: FiltroPrevisaoFaturamentoProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>('dias');
  const [diasFiltro, setDiasFiltro] = useState<number>(30);
  const [dataFiltro, setDataFiltro] = useState<Date | undefined>(addDays(new Date(), 30));
  const [categorias, setCategorias] = useState<CategoriasFiltro>({
    aPagar: true,
    emRevisao: true,
    emAtraso: true,
    incluirAcumulado: true,
  });

  const hoje = startOfDay(new Date());
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

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
    let totalAPagar = 0;
    let totalEmRevisao = 0;
    let totalEmAtraso = 0;
    let clientesComVencimento = 0;

    const parseDateOnlyISO = (dateStr: string): Date => {
      const [ano, mes, dia] = dateStr.split('-').map(Number);
      return new Date(ano, mes - 1, dia);
    };

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

      // Check if client is in review for the current month
      const mesAnoAtual = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;
      const estaEmRevisao = cliente.em_revisao && cliente.mes_referencia_revisao === mesAnoAtual;

      // Check if client paid this month
      const ultimoPagamento = cliente.data_ultimo_pagamento ? parseDateOnlyISO(cliente.data_ultimo_pagamento) : null;
      const pagouNesteMes = ultimoPagamento
        ? ultimoPagamento.getMonth() === mesAtual && ultimoPagamento.getFullYear() === anoAtual
        : false;

      // Calculate current month's due date
      const vencimentoMesAtual = getDueDate(anoAtual, mesAtual, cliente.dia_vencimento);
      const estaAtrasado = !pagouNesteMes && !estaEmRevisao && hoje > vencimentoMesAtual;

      let clienteContado = false;

      // Calculate how many months overdue (for accumulated value)
      let mesesEmAtraso = 0;
      if (estaAtrasado && categorias.incluirAcumulado) {
        // Count consecutive overdue months
        for (let i = 0; i < 12; i++) {
          const mesVerificar = new Date(anoAtual, mesAtual - i, 1);
          const numeroParcela = ((mesVerificar.getFullYear() - dataInicio.getFullYear()) * 12 + 
                                 (mesVerificar.getMonth() - dataInicio.getMonth())) + 1;
          
          if (numeroParcela > 0 && numeroParcela <= totalParcelas && numeroParcela > parcelasPagas) {
            const vencimentoMes = getDueDate(mesVerificar.getFullYear(), mesVerificar.getMonth(), cliente.dia_vencimento);
            if (hoje > vencimentoMes) {
              mesesEmAtraso++;
            } else {
              break;
            }
          } else {
            break;
          }
        }
      }

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
        const dentroDoIntervalo = !isBefore(dueDate, hoje) && !isAfter(startOfDay(dueDate), startOfDay(dataAlvo));
        const isDataPassada = dueDate < hoje;

        if (dentroDoIntervalo) {
          // Future payment within range
          if (categorias.aPagar) {
            totalAPagar += valorParcela;
            totalPrevisao += valorParcela;
            if (!clienteContado) {
              clientesComVencimento++;
              clienteContado = true;
            }
          }
        } else if (isDataPassada && numeroParcela > parcelasPagas) {
          // Check if this is a past due parcel
          const mesVencimento = dueDate.getMonth();
          const anoVencimento = dueDate.getFullYear();
          const mesAnoVencimento = `${anoVencimento}-${String(mesVencimento + 1).padStart(2, '0')}`;

          // Is this the current month and in review?
          if (mesVencimento === mesAtual && anoVencimento === anoAtual && estaEmRevisao) {
            if (categorias.emRevisao) {
              totalEmRevisao += valorParcela;
              totalPrevisao += valorParcela;
              if (!clienteContado) {
                clientesComVencimento++;
                clienteContado = true;
              }
            }
          } else if (estaAtrasado) {
            // Past due - overdue
            if (categorias.emAtraso) {
              // If incluirAcumulado is true, we already counted above for multiple months
              // Here we add each overdue parcel if within the accumulated months
              if (categorias.incluirAcumulado) {
                const mesesDesdeVencimento = (anoAtual - anoVencimento) * 12 + (mesAtual - mesVencimento);
                if (mesesDesdeVencimento < mesesEmAtraso) {
                  totalEmAtraso += valorParcela;
                  totalPrevisao += valorParcela;
                  if (!clienteContado) {
                    clientesComVencimento++;
                    clienteContado = true;
                  }
                }
              } else {
                // Only count current month overdue
                if (mesVencimento === mesAtual && anoVencimento === anoAtual) {
                  totalEmAtraso += valorParcela;
                  totalPrevisao += valorParcela;
                  if (!clienteContado) {
                    clientesComVencimento++;
                    clienteContado = true;
                  }
                }
              }
            }
          }
        }
      }
    });

    return { 
      total: totalPrevisao, 
      aPagar: totalAPagar,
      emRevisao: totalEmRevisao,
      emAtraso: totalEmAtraso,
      clientes: clientesComVencimento 
    };
  }, [clientes, dataAlvo, hoje, categorias, mesAtual, anoAtual]);

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

  const toggleCategoria = (key: keyof CategoriasFiltro) => {
    setCategorias(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Previsão por Período</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
              <span className="text-sm text-muted-foreground">dias</span>
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

        {/* Category Filters */}
        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground">Incluir na previsão:</p>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="aPagar" 
                checked={categorias.aPagar}
                onCheckedChange={() => toggleCategoria('aPagar')}
              />
              <Label htmlFor="aPagar" className="text-sm cursor-pointer flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-info"></span>
                A pagar
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="emRevisao" 
                checked={categorias.emRevisao}
                onCheckedChange={() => toggleCategoria('emRevisao')}
              />
              <Label htmlFor="emRevisao" className="text-sm cursor-pointer flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-warning"></span>
                Em revisão
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="emAtraso" 
                checked={categorias.emAtraso}
                onCheckedChange={() => toggleCategoria('emAtraso')}
              />
              <Label htmlFor="emAtraso" className="text-sm cursor-pointer flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive"></span>
                Em atraso
              </Label>
            </div>
            
            {categorias.emAtraso && (
              <div className="flex items-center space-x-2 pl-4">
                <Checkbox 
                  id="incluirAcumulado" 
                  checked={categorias.incluirAcumulado}
                  onCheckedChange={() => toggleCategoria('incluirAcumulado')}
                />
                <Label htmlFor="incluirAcumulado" className="text-xs cursor-pointer text-muted-foreground">
                  Incluir parcelas acumuladas
                </Label>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="pt-3 border-t border-border">
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Previsão para os próximos {diasRestantes} dias
            </p>
            <p className="text-3xl font-bold text-primary">
              {formatCurrency(previsao.total)}
            </p>
            
            {/* Breakdown by category */}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
              {previsao.aPagar > 0 && (
                <span className="text-info">A pagar: {formatCurrency(previsao.aPagar)}</span>
              )}
              {previsao.emRevisao > 0 && (
                <span className="text-warning">Revisão: {formatCurrency(previsao.emRevisao)}</span>
              )}
              {previsao.emAtraso > 0 && (
                <span className="text-destructive">Atraso: {formatCurrency(previsao.emAtraso)}</span>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground">
              {previsao.clientes} cliente{previsao.clientes !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              Até {format(dataAlvo, "dd/MM/yyyy")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
