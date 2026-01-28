import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ClienteCalculado } from '@/types/cliente';
import { Calendar, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface ForecastChartProps {
  clientes: ClienteCalculado[];
}

type ViewMode = 'mensal' | 'diario';

interface ClienteSegmento {
  clienteId: string;
  clienteNome: string;
  valor: number;
  status: 'pago' | 'atrasado' | 'pendente';
}

interface DiaData {
  nome: string;
  dia: number;
  isHoje: boolean;
  clientes: ClienteSegmento[];
  [key: string]: any; // Dynamic keys for each client
}

// Generate distinct colors for clients
const generateColor = (index: number, total: number) => {
  const hue = (index * 360 / Math.max(total, 8)) % 360;
  return `hsl(${hue}, 65%, 55%)`;
};

export function ForecastChart({ clientes }: ForecastChartProps) {
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

  // Daily forecast data for selected month with client segments
  const { dailyData, clienteKeys, clienteColors } = useMemo(() => {
    const hoje = new Date();
    const mesAlvo = selectedMonth.getMonth();
    const anoAlvo = selectedMonth.getFullYear();
    const ultimoDiaMes = new Date(anoAlvo, mesAlvo + 1, 0).getDate();

    const isMesAtual = mesAlvo === hoje.getMonth() && anoAlvo === hoje.getFullYear();
    const isMesPassado = new Date(anoAlvo, mesAlvo, 1) < new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    // Collect all clients that have payments in this month
    const clientesNoMes: Map<string, { nome: string; color: string }> = new Map();
    
    // First pass: identify all clients with due dates in this month
    clientes.forEach((cliente) => {
      if (cliente.status_cliente !== 'ATIVO') return;

      const [year, month] = cliente.data_inicio.split('-').map(Number);
      const dataInicio = new Date(year, month - 1, 1);

      const getDueDate = (y: number, m: number) => {
        const lastDay = new Date(y, m + 1, 0).getDate();
        return Math.min(cliente.dia_vencimento, lastDay);
      };

      const primeiroPagamentoMes = dataInicio.getMonth();
      const primeiroPagamentoAno = dataInicio.getFullYear();
      const mesesDesdeInicio = (anoAlvo - primeiroPagamentoAno) * 12 + (mesAlvo - primeiroPagamentoMes);

      if (mesesDesdeInicio >= 0 && mesesDesdeInicio < cliente.total_parcelas) {
        clientesNoMes.set(cliente.id, { nome: cliente.cliente_nome, color: '' });
      }
    });

    // Assign colors to clients
    const clienteArray = Array.from(clientesNoMes.entries());
    clienteArray.forEach(([id, data], index) => {
      data.color = generateColor(index, clienteArray.length);
    });

    // Initialize all days of the month
    const dias: DiaData[] = [];
    for (let d = 1; d <= ultimoDiaMes; d++) {
      const isHoje = isMesAtual && d === hoje.getDate();
      
      const diaData: DiaData = {
        nome: d.toString().padStart(2, '0'),
        dia: d,
        isHoje,
        clientes: [],
      };

      // Initialize all client keys to 0
      clientesNoMes.forEach((_, clienteId) => {
        diaData[`cliente_${clienteId}`] = 0;
        diaData[`cliente_${clienteId}_atrasado`] = 0;
      });

      dias.push(diaData);
    }

    // Second pass: assign values to days
    clientes.forEach((cliente) => {
      if (cliente.status_cliente !== 'ATIVO') return;
      if (!clientesNoMes.has(cliente.id)) return;

      const valorParcela = cliente.valor_parcela;
      const [year, month] = cliente.data_inicio.split('-').map(Number);
      const dataInicio = new Date(year, month - 1, 1);

      const getDueDateForMonth = (y: number, m: number) => {
        const lastDay = new Date(y, m + 1, 0).getDate();
        return Math.min(cliente.dia_vencimento, lastDay);
      };

      const primeiroPagamentoMes = dataInicio.getMonth();
      const primeiroPagamentoAno = dataInicio.getFullYear();
      const mesesDesdeInicio = (anoAlvo - primeiroPagamentoAno) * 12 + (mesAlvo - primeiroPagamentoMes);

      if (mesesDesdeInicio >= 0 && mesesDesdeInicio < cliente.total_parcelas) {
        const diaVencimento = getDueDateForMonth(anoAlvo, mesAlvo);
        const diaIndex = diaVencimento - 1;

        if (diaIndex >= 0 && diaIndex < dias.length) {
          // Check if client already paid this month
          const pagouNesteMes = cliente.data_ultimo_pagamento 
            ? (() => {
                const [ano, mes] = cliente.data_ultimo_pagamento.split('-').map(Number);
                return ano === anoAlvo && mes - 1 === mesAlvo;
              })()
            : false;

          let status: 'pago' | 'atrasado' | 'pendente' = 'pendente';
          
          if (pagouNesteMes) {
            status = 'pago';
            dias[diaIndex][`cliente_${cliente.id}`] = valorParcela;
          } else if ((isMesAtual && diaVencimento < hoje.getDate()) || isMesPassado) {
            status = 'atrasado';
            dias[diaIndex][`cliente_${cliente.id}_atrasado`] = valorParcela;
          } else {
            dias[diaIndex][`cliente_${cliente.id}`] = valorParcela;
          }

          dias[diaIndex].clientes.push({
            clienteId: cliente.id,
            clienteNome: cliente.cliente_nome,
            valor: valorParcela,
            status,
          });
        }
      }
    });

    // Build keys for rendering bars
    const keys: string[] = [];
    const colors: Map<string, string> = new Map();

    clientesNoMes.forEach((data, clienteId) => {
      keys.push(`cliente_${clienteId}`);
      keys.push(`cliente_${clienteId}_atrasado`);
      colors.set(`cliente_${clienteId}`, data.color);
      colors.set(`cliente_${clienteId}_atrasado`, 'hsl(var(--destructive))');
    });

    return { dailyData: dias, clienteKeys: keys, clienteColors: colors };
  }, [clientes, selectedMonth]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const DailyTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    // Find the day data
    const dayData = dailyData.find(d => d.nome === label);
    if (!dayData) return null;

    const total = dayData.clientes.reduce((acc, c) => acc + c.valor, 0);

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg max-w-[250px]">
        <p className="text-sm font-medium text-foreground mb-2">
          Dia {label} {dayData.isHoje && <span className="text-primary">(Hoje)</span>}
        </p>
        {dayData.clientes.length > 0 ? (
          <div className="space-y-1.5">
            {dayData.clientes.map((c, i) => (
              <div key={c.clienteId} className="flex justify-between items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div 
                    className="w-2.5 h-2.5 rounded-sm shrink-0" 
                    style={{ 
                      backgroundColor: c.status === 'atrasado' 
                        ? 'hsl(var(--destructive))' 
                        : clienteColors.get(`cliente_${c.clienteId}`) 
                    }} 
                  />
                  <span className="truncate text-muted-foreground">{c.clienteNome}</span>
                </div>
                <span className={`font-medium shrink-0 ${c.status === 'atrasado' ? 'text-destructive' : ''}`}>
                  {formatCurrency(c.valor)}
                </span>
              </div>
            ))}
            <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between">
              <span className="text-xs font-medium">Total</span>
              <span className="text-sm font-bold text-primary">{formatCurrency(total)}</span>
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
  const { totalDiario, totalAtrasado } = useMemo(() => {
    if (viewMode !== 'diario') return { totalDiario: 0, totalAtrasado: 0 };
    
    let total = 0;
    let atrasado = 0;
    
    dailyData.forEach(d => {
      d.clientes.forEach(c => {
        total += c.valor;
        if (c.status === 'atrasado') {
          atrasado += c.valor;
        }
      });
    });
    
    return { totalDiario: total, totalAtrasado: atrasado };
  }, [dailyData, viewMode]);

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
                {clienteKeys.map((key) => {
                  const isAtrasado = key.endsWith('_atrasado');
                  const color = clienteColors.get(key) || 'hsl(var(--info))';
                  
                  return (
                    <Bar 
                      key={key} 
                      dataKey={key} 
                      stackId="clientes" 
                      fill={color}
                      radius={[0, 0, 0, 0]}
                    />
                  );
                })}
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
            {totalAtrasado > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-destructive" />
                <span className="text-muted-foreground">Atrasado ({formatCurrency(totalAtrasado)})</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, hsl(200, 65%, 55%) 0%, hsl(280, 65%, 55%) 100%)' }} />
              <span className="text-muted-foreground">Clientes ({dailyData.reduce((acc, d) => acc + d.clientes.length, 0)} no mês)</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}