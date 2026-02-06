import { useMemo, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ClienteCalculado } from '@/types/cliente';
import { Calendar, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface ForecastChartProps {
  clientes: ClienteCalculado[];
  hideValues?: boolean;
}

type ViewMode = 'mensal' | 'diario';

export function ForecastChart({ clientes, hideValues = false }: ForecastChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('mensal');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());

  // Monthly forecast data (existing logic)
  const monthlyData = useMemo(() => {
    const hoje = new Date();
    const meses: { nome: string; valor: number; mes: number; ano: number }[] = [];

    for (let i = 0; i < 12; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      meses.push({
        nome: data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        valor: 0,
        mes: data.getMonth(),
        ano: data.getFullYear(),
      });
    }

    clientes.forEach((cliente) => {
      if (cliente.status_cliente !== 'ATIVO') return;

      const valorParcela = cliente.valor_parcela;
      const totalParcelas = cliente.total_parcelas;

      const [year, month] = cliente.data_inicio.split('-').map(Number);
      const dataInicio = new Date(year, month - 1, 1);

      const getDueDate = (year: number, month: number) => {
        const base = new Date(year, month, 1);
        const y = base.getFullYear();
        const m = base.getMonth();
        const lastDay = new Date(y, m + 1, 0).getDate();
        const dia = Math.min(cliente.dia_vencimento, lastDay);
        return new Date(y, m, dia);
      };

      const primeiroPagamento = getDueDate(dataInicio.getFullYear(), dataInicio.getMonth());

      for (let i = 0; i < totalParcelas; i++) {
        const due = getDueDate(primeiroPagamento.getFullYear(), primeiroPagamento.getMonth() + i);
        const mesIndex = meses.findIndex((m) => m.mes === due.getMonth() && m.ano === due.getFullYear());

        if (mesIndex !== -1) {
          meses[mesIndex].valor += valorParcela;
        }
      }
    });

    return meses;
  }, [clientes]);

  // Daily forecast data for selected month
  const dailyData = useMemo(() => {
    const hoje = new Date();
    const mesAlvo = selectedMonth.getMonth();
    const anoAlvo = selectedMonth.getFullYear();
    const ultimoDiaMes = new Date(anoAlvo, mesAlvo + 1, 0).getDate();

    const isMesAtual = mesAlvo === hoje.getMonth() && anoAlvo === hoje.getFullYear();
    const isMesFuturo = new Date(anoAlvo, mesAlvo, 1) > new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const dias: { 
      nome: string; 
      valorPendente: number; // Future payments (gray)
      valorPago: number; // Paid (green)
      valorAtrasado: number; // Overdue (red)
      valorHojePendente: number; // Today's pending (gray until marked)
      dia: number; 
      isHoje: boolean;
    }[] = [];
    
    for (let d = 1; d <= ultimoDiaMes; d++) {
      dias.push({
        nome: d.toString().padStart(2, '0'),
        valorPendente: 0,
        valorPago: 0,
        valorAtrasado: 0,
        valorHojePendente: 0,
        dia: d,
        isHoje: isMesAtual && d === hoje.getDate(),
      });
    }

    clientes.forEach((cliente) => {
      if (cliente.status_cliente !== 'ATIVO') return;

      const valorParcela = cliente.valor_parcela;
      const totalParcelas = cliente.total_parcelas;
      const parcelasPagas = cliente.parcelas_pagas;

      const [year, month] = cliente.data_inicio.split('-').map(Number);
      const primeiroPagamentoMes = month - 1;
      const primeiroPagamentoAno = year;

      const mesesDesdeInicio = (anoAlvo - primeiroPagamentoAno) * 12 + (mesAlvo - primeiroPagamentoMes);
      const numeroParcela = mesesDesdeInicio + 1;

      if (numeroParcela >= 1 && numeroParcela <= totalParcelas) {
        const diaVencimento = Math.min(cliente.dia_vencimento, ultimoDiaMes);
        const diaIndex = diaVencimento - 1;

        if (diaIndex >= 0 && diaIndex < dias.length) {
          const parcelaPaga = parcelasPagas >= numeroParcela;
          const isDataFutura = isMesFuturo || (isMesAtual && diaVencimento > hoje.getDate());
          const isHoje = isMesAtual && diaVencimento === hoje.getDate();

          if (parcelaPaga) {
            // Already paid = GREEN
            dias[diaIndex].valorPago += valorParcela;
          } else if (isDataFutura) {
            // Future date = GRAY (pending)
            dias[diaIndex].valorPendente += valorParcela;
          } else if (isHoje) {
            // Today and not paid yet = GRAY (pending for today)
            dias[diaIndex].valorHojePendente += valorParcela;
          } else {
            // Past due date and not paid = RED (overdue)
            dias[diaIndex].valorAtrasado += valorParcela;
          }
        }
      }
    });

    return dias;
  }, [clientes, selectedMonth]);

  const formatCurrency = (value: number) => {
    if (hideValues) return '••••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const DailyTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const dayData = dailyData.find(d => d.nome === label);
    if (!dayData) return null;

    const total = dayData.valorPendente + dayData.valorPago + dayData.valorAtrasado + dayData.valorHojePendente;

    return (
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl p-4 shadow-2xl">
        <p className="text-sm font-semibold text-foreground mb-2">
          Dia {label} {dayData.isHoje && <span className="text-primary ml-1">(Hoje)</span>}
        </p>
        {total > 0 ? (
          <div className="space-y-1.5">
            {(dayData.valorPendente > 0 || dayData.valorHojePendente > 0) && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                A receber: {formatCurrency(dayData.valorPendente + dayData.valorHojePendente)}
              </p>
            )}
            {dayData.valorPago > 0 && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Pago: {formatCurrency(dayData.valorPago)}
              </p>
            )}
            {dayData.valorAtrasado > 0 && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                Atrasado: {formatCurrency(dayData.valorAtrasado)}
              </p>
            )}
            <div className="pt-2 mt-2 border-t border-border/50">
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(total)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum vencimento</p>
        )}
      </div>
    );
  };

  const MonthlyTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl p-4 shadow-2xl">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-1">
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  };

  const nomeMes = selectedMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const { totalDiario, totalAtrasado, totalPendente, totalPago } = useMemo(() => {
    if (viewMode !== 'diario') return { totalDiario: 0, totalAtrasado: 0, totalPendente: 0, totalPago: 0 };
    
    let total = 0;
    let atrasado = 0;
    let pendente = 0;
    let pago = 0;
    
    dailyData.forEach(d => {
      total += d.valorPendente + d.valorPago + d.valorAtrasado + d.valorHojePendente;
      atrasado += d.valorAtrasado;
      pendente += d.valorPendente + d.valorHojePendente;
      pago += d.valorPago;
    });
    
    return { totalDiario: total, totalAtrasado: atrasado, totalPendente: pendente, totalPago: pago };
  }, [dailyData, viewMode]);

  const hoje = new Date();
  const hojeIndex = useMemo(() => {
    if (viewMode !== 'diario') return -1;
    const mesAlvo = selectedMonth.getMonth();
    const anoAlvo = selectedMonth.getFullYear();
    if (mesAlvo === hoje.getMonth() && anoAlvo === hoje.getFullYear()) {
      return hoje.getDate();
    }
    return -1;
  }, [selectedMonth, viewMode]);

  // Calculate total for monthly view
  const totalMensal = useMemo(() => {
    return monthlyData.reduce((sum, m) => sum + m.valor, 0);
  }, [monthlyData]);

  return (
    <Card className="glass overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold">
              {viewMode === 'mensal' 
                ? 'Previsão de Faturamento' 
                : 'Receita do Mês'
              }
            </CardTitle>
            <p className="text-2xl font-bold text-primary">
              {viewMode === 'mensal' ? formatCurrency(totalMensal) : formatCurrency(totalDiario)}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {viewMode === 'mensal' ? 'próximos 12 meses' : 'previsão'}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {viewMode === 'diario' && (
              <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-background/50"
                  onClick={() => navigateMonth('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[130px] text-center capitalize px-2">
                  {nomeMes}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-background/50"
                  onClick={() => navigateMonth('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList className="bg-secondary/50 p-1">
                <TabsTrigger 
                  value="mensal" 
                  className="px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span className="hidden sm:inline">Mensal</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="diario" 
                  className="px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="hidden sm:inline">Diário</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'mensal' ? (
              <AreaChart data={monthlyData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="nome"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()}
                  dx={-10}
                />
                <Tooltip content={<MonthlyTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area 
                  type="monotone" 
                  dataKey="valor" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2.5}
                  fill="url(#colorValor)" 
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                  activeDot={{ fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 3, r: 6 }}
                />
              </AreaChart>
            ) : (
              <BarChart data={dailyData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                <XAxis
                  dataKey="nome"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  interval={1}
                  dy={10}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()}
                  dx={-10}
                />
                <Tooltip content={<DailyTooltip />} cursor={{ fill: 'hsl(var(--primary))', opacity: 0.1 }} />
                {hojeIndex > 0 && (
                  <ReferenceLine 
                    x={hojeIndex.toString().padStart(2, '0')} 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                )}
                {/* Paid - GREEN */}
                <Bar 
                  dataKey="valorPago" 
                  stackId="a" 
                  fill="hsl(142 76% 36%)"
                  radius={[0, 0, 0, 0]}
                />
                {/* Future pending - GRAY */}
                <Bar 
                  dataKey="valorPendente" 
                  stackId="a" 
                  fill="hsl(var(--muted-foreground))"
                  opacity={0.4}
                  radius={[0, 0, 0, 0]}
                />
                {/* Today pending - GRAY */}
                <Bar 
                  dataKey="valorHojePendente" 
                  stackId="a" 
                  fill="hsl(var(--muted-foreground))"
                  opacity={0.5}
                  radius={[0, 0, 0, 0]}
                />
                {/* Overdue - RED */}
                <Bar dataKey="valorAtrasado" stackId="a" radius={[4, 4, 0, 0]}>
                  {dailyData.map((_, index) => (
                    <Cell 
                      key={`cell-atrasado-${index}`} 
                      fill="hsl(var(--destructive))" 
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        {viewMode === 'diario' && (
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border/30">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted-foreground/50" />
              <span className="text-xs text-muted-foreground">A receber</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">Pago</span>
            </div>
            {totalAtrasado > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span className="text-xs text-muted-foreground">Atrasado</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}