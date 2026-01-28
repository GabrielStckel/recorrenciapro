import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
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

    // Initialize all days of the month
    const dias: { 
      nome: string; 
      valor: number; 
      valorPago: number;
      valorAtrasado: number; 
      valorEmRevisao: number; 
      dia: number; 
      isHoje: boolean;
      clientesAReceber: number[]; // Individual client values for future pending payments
    }[] = [];
    for (let d = 1; d <= ultimoDiaMes; d++) {
      dias.push({
        nome: d.toString().padStart(2, '0'),
        valor: 0,
        valorPago: 0,
        valorAtrasado: 0,
        valorEmRevisao: 0,
        dia: d,
        isHoje: isMesAtual && d === hoje.getDate(),
        clientesAReceber: [],
      });
    }

    // Calculate expected payments per day
    clientes.forEach((cliente) => {
      if (cliente.status_cliente !== 'ATIVO') return;

      const valorParcela = cliente.valor_parcela;
      const totalParcelas = cliente.total_parcelas;
      const parcelasPagas = cliente.parcelas_pagas;

      // Parse data_inicio
      const [year, month] = cliente.data_inicio.split('-').map(Number);
      const primeiroPagamentoMes = month - 1; // 0-indexed
      const primeiroPagamentoAno = year;

      // Calculate which parcel number would be due in the selected month (1-indexed)
      const mesesDesdeInicio = (anoAlvo - primeiroPagamentoAno) * 12 + (mesAlvo - primeiroPagamentoMes);
      const numeroParcela = mesesDesdeInicio + 1; // Parcel number (1-indexed)

      // Only include if this month falls within the contract period
      if (numeroParcela >= 1 && numeroParcela <= totalParcelas) {
        const diaVencimento = Math.min(cliente.dia_vencimento, ultimoDiaMes);
        const diaIndex = diaVencimento - 1;

        if (diaIndex >= 0 && diaIndex < dias.length) {
          // Check if this specific parcel was already paid
          const parcelaPaga = parcelasPagas >= numeroParcela;

          // Check if client is in review for the selected month
          const mesRevisaoCliente = cliente.mes_referencia_revisao;
          const mesAnoAlvo = `${anoAlvo}-${String(mesAlvo + 1).padStart(2, '0')}`;
          const estaEmRevisaoNoMes = cliente.em_revisao && mesRevisaoCliente === mesAnoAlvo;

          const isDataFutura = isMesFuturo || (isMesAtual && diaVencimento > hoje.getDate());

          if (parcelaPaga) {
            // Already paid - show as paid (gray)
            dias[diaIndex].valorPago += valorParcela;
          } else if (estaEmRevisaoNoMes) {
            // Client is in review - show with warning color
            dias[diaIndex].valorEmRevisao += valorParcela;
          } else if (isDataFutura) {
            // Future date - show as pending (blue) and track individual clients
            dias[diaIndex].valor += valorParcela;
            dias[diaIndex].clientesAReceber.push(valorParcela);
          } else if (isMesAtual && diaVencimento === hoje.getDate()) {
            // Today - show with status colors (em revisão or pago), not as generic pending
            // If not paid and not in review yet, it's still pending for today
            dias[diaIndex].valor += valorParcela;
          } else {
            // Past due date and not paid and not in review - overdue (red)
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

    const total = dayData.valor + dayData.valorPago + dayData.valorAtrasado + dayData.valorEmRevisao;
    const numClientes = dayData.clientesAReceber.length;

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-1">
          Dia {label} {dayData.isHoje && <span className="text-primary">(Hoje)</span>}
        </p>
        {total > 0 ? (
          <>
            {dayData.valor > 0 && (
              <p className="text-sm text-muted-foreground">
                A receber: {formatCurrency(dayData.valor)}
                {numClientes > 0 && ` (${numClientes} cliente${numClientes > 1 ? 's' : ''})`}
              </p>
            )}
            {dayData.valorPago > 0 && (
              <p className="text-sm text-muted-foreground">
                Pago: {formatCurrency(dayData.valorPago)}
              </p>
            )}
            {dayData.valorEmRevisao > 0 && (
              <p className="text-sm text-warning">
                Em revisão: {formatCurrency(dayData.valorEmRevisao)}
              </p>
            )}
            {dayData.valorAtrasado > 0 && (
              <p className="text-sm text-destructive">
                Atrasado: {formatCurrency(dayData.valorAtrasado)}
              </p>
            )}
            <p className="text-lg font-bold text-primary mt-1">
              Total: {formatCurrency(total)}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum vencimento</p>
        )}
      </div>
    );
  };

  const MonthlyTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-lg font-bold text-primary">
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

  // Calculate totals for daily view
  const { totalDiario, totalAtrasado, totalEmRevisao, totalPago } = useMemo(() => {
    if (viewMode !== 'diario') return { totalDiario: 0, totalAtrasado: 0, totalEmRevisao: 0, totalPago: 0 };
    
    let total = 0;
    let atrasado = 0;
    let emRevisao = 0;
    let pago = 0;
    
    dailyData.forEach(d => {
      total += d.valor + d.valorPago + d.valorAtrasado + d.valorEmRevisao;
      atrasado += d.valorAtrasado;
      emRevisao += d.valorEmRevisao;
      pago += d.valorPago;
    });
    
    return { totalDiario: total, totalAtrasado: atrasado, totalEmRevisao: emRevisao, totalPago: pago };
  }, [dailyData, viewMode]);

  // Custom bar shape that shows separators between clients for future days
  const CustomBarWithSeparators = (props: any) => {
    const { x, y, width, height, payload } = props;
    
    if (!payload || !payload.clientesAReceber || payload.clientesAReceber.length <= 1 || height <= 0) {
      // No separators needed - just render normal rectangle
      return <rect x={x} y={y} width={width} height={height} fill="hsl(var(--info))" opacity={0.7} />;
    }

    const clientes = payload.clientesAReceber;
    const total = clientes.reduce((sum: number, v: number) => sum + v, 0);
    
    if (total <= 0) {
      return <rect x={x} y={y} width={width} height={height} fill="hsl(var(--info))" opacity={0.7} />;
    }

    // Render segments with separators
    const segments: JSX.Element[] = [];
    let currentY = y;
    
    clientes.forEach((valor: number, idx: number) => {
      const segmentHeight = (valor / total) * height;
      
      segments.push(
        <rect
          key={`segment-${idx}`}
          x={x}
          y={currentY}
          width={width}
          height={Math.max(0, segmentHeight - (idx < clientes.length - 1 ? 1 : 0))}
          fill="hsl(var(--info))"
          opacity={0.7}
        />
      );
      
      // Add separator line between segments
      if (idx < clientes.length - 1 && segmentHeight > 2) {
        segments.push(
          <line
            key={`sep-${idx}`}
            x1={x}
            y1={currentY + segmentHeight}
            x2={x + width}
            y2={currentY + segmentHeight}
            stroke="hsl(var(--background))"
            strokeWidth={1}
          />
        );
      }
      
      currentY += segmentHeight;
    });

    return <g>{segments}</g>;
  };

  // Find today's index for the reference line
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

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">
              {viewMode === 'mensal' 
                ? 'Previsão de Faturamento (12 meses)' 
                : 'Previsão do Mês'
              }
            </CardTitle>
            {viewMode === 'diario' && (
              <span className="text-sm text-muted-foreground">
                ({formatCurrency(totalDiario)})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {viewMode === 'diario' && (
              <div className="flex items-center gap-1 mr-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => navigateMonth('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[120px] text-center capitalize">
                  {nomeMes}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => navigateMonth('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="mensal" className="h-7 px-3 text-xs gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Mensal
                </TabsTrigger>
                <TabsTrigger value="diario" className="h-7 px-3 text-xs gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Diário
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'mensal' ? (
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="nome"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(value) => value >= 1000 ? `R$${value / 1000}k` : `R$${value}`}
                />
                <Tooltip content={<MonthlyTooltip />} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--info))'} 
                      opacity={index === 0 ? 1 : 0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="nome"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  interval={1}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(value) => value >= 1000 ? `R$${value / 1000}k` : `R$${value}`}
                />
                <Tooltip content={<DailyTooltip />} />
                {hojeIndex > 0 && (
                  <ReferenceLine 
                    x={hojeIndex.toString().padStart(2, '0')} 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                )}
                <Bar dataKey="valorPago" stackId="a" radius={[0, 0, 0, 0]}>
                  {dailyData.map((_, index) => (
                    <Cell 
                      key={`cell-pago-${index}`} 
                      fill="hsl(var(--muted-foreground))" 
                      opacity={0.5}
                    />
                  ))}
                </Bar>
                <Bar 
                  dataKey="valor" 
                  stackId="a" 
                  radius={[0, 0, 0, 0]}
                  shape={(props: any) => {
                    const entry = dailyData[props.index];
                    // For future days with multiple clients, use custom separator bar
                    if (entry && entry.clientesAReceber && entry.clientesAReceber.length > 1) {
                      return <CustomBarWithSeparators {...props} payload={entry} />;
                    }
                    // For today or past days, use normal bar with appropriate color
                    let fill = 'hsl(var(--info))';
                    let opacity = 0.7;

                    if (entry) {
                      if (entry.dia < new Date().getDate() && 
                          selectedMonth.getMonth() === new Date().getMonth() && 
                          selectedMonth.getFullYear() === new Date().getFullYear()) {
                        fill = 'hsl(var(--muted-foreground))';
                        opacity = 0.5;
                      } else if (selectedMonth < new Date(new Date().getFullYear(), new Date().getMonth(), 1)) {
                        fill = 'hsl(var(--muted-foreground))';
                        opacity = 0.5;
                      }
                    }

                    return (
                      <rect 
                        x={props.x} 
                        y={props.y} 
                        width={props.width} 
                        height={props.height} 
                        fill={fill} 
                        opacity={opacity}
                      />
                    );
                  }}
                />
                <Bar dataKey="valorEmRevisao" stackId="a" radius={[0, 0, 0, 0]}>
                  {dailyData.map((_, index) => (
                    <Cell 
                      key={`cell-revisao-${index}`} 
                      fill="hsl(var(--warning))" 
                      opacity={1}
                    />
                  ))}
                </Bar>
                <Bar dataKey="valorAtrasado" stackId="a" radius={[4, 4, 0, 0]}>
                  {dailyData.map((_, index) => (
                    <Cell 
                      key={`cell-atrasado-${index}`} 
                      fill="hsl(var(--destructive))" 
                      opacity={1}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        {viewMode === 'diario' && (
          <div className="flex items-center justify-center gap-4 mt-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-primary" style={{ borderTop: '2px dashed hsl(var(--primary))' }} />
              <span className="text-muted-foreground">Hoje</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-info opacity-70" />
              <span className="text-muted-foreground">A receber</span>
            </div>
            {totalEmRevisao > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-warning" />
                <span className="text-muted-foreground">Em revisão</span>
              </div>
            )}
            {totalAtrasado > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-destructive" />
                <span className="text-muted-foreground">Atrasado</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-muted-foreground opacity-50" />
              <span className="text-muted-foreground">Pago</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}