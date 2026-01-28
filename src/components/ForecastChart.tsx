import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ClienteCalculado } from '@/types/cliente';
import { Calendar, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface ForecastChartProps {
  clientes: ClienteCalculado[];
}

type ViewMode = 'mensal' | 'diario';

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

      const [year, month, day] = cliente.data_inicio.split('-').map(Number);
      const dataInicio = new Date(year, month - 1, day);

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
    const isMesPassado = new Date(anoAlvo, mesAlvo, 1) < new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    // Initialize all days of the month
    const dias: { nome: string; valor: number; dia: number; passado: boolean; hoje: boolean; status: 'futuro' | 'hoje' | 'passado' | 'atrasado' }[] = [];
    for (let d = 1; d <= ultimoDiaMes; d++) {
      let status: 'futuro' | 'hoje' | 'passado' | 'atrasado' = 'futuro';
      
      if (isMesPassado) {
        status = 'passado';
      } else if (isMesAtual) {
        if (d < hoje.getDate()) {
          status = 'passado';
        } else if (d === hoje.getDate()) {
          status = 'hoje';
        }
      }

      dias.push({
        nome: d.toString().padStart(2, '0'),
        valor: 0,
        dia: d,
        passado: status === 'passado',
        hoje: status === 'hoje',
        status,
      });
    }

    // Calculate expected payments per day based on contract (not payment status)
    clientes.forEach((cliente) => {
      if (cliente.status_cliente !== 'ATIVO') return;

      const valorParcela = cliente.valor_parcela;
      const totalParcelas = cliente.total_parcelas;

      // Parse data_inicio
      const [year, month] = cliente.data_inicio.split('-').map(Number);
      const dataInicio = new Date(year, month - 1, 1);

      // Calculate the due date for the selected month
      const getDueDate = (y: number, m: number) => {
        const lastDay = new Date(y, m + 1, 0).getDate();
        const dia = Math.min(cliente.dia_vencimento, lastDay);
        return new Date(y, m, dia);
      };

      // First payment month
      const primeiroPagamentoData = getDueDate(dataInicio.getFullYear(), dataInicio.getMonth());

      // Calculate which parcel number corresponds to the selected month
      const mesesDesdeInicio = (anoAlvo - primeiroPagamentoData.getFullYear()) * 12 + (mesAlvo - primeiroPagamentoData.getMonth());

      // Only include if this month falls within the contract period
      if (mesesDesdeInicio >= 0 && mesesDesdeInicio < totalParcelas) {
        const diaVencimento = Math.min(cliente.dia_vencimento, ultimoDiaMes);
        const diaIndex = diaVencimento - 1;

        if (diaIndex >= 0 && diaIndex < dias.length) {
          dias[diaIndex].valor += valorParcela;

          // Mark as overdue if payment is past due and not paid
          if (isMesAtual && diaVencimento < hoje.getDate()) {
            // Check if client paid this month
            const pagouNesteMes = cliente.data_ultimo_pagamento 
              ? (() => {
                  const [ano, mes] = cliente.data_ultimo_pagamento.split('-').map(Number);
                  return ano === anoAlvo && mes - 1 === mesAlvo;
                })()
              : false;

            if (!pagouNesteMes) {
              dias[diaIndex].status = 'atrasado';
            }
          }
        }
      }
    });

    return dias;
  }, [clientes, selectedMonth]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isDaily = viewMode === 'diario';
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">
            {isDaily ? `Dia ${label}` : label}
          </p>
          <p className="text-lg font-bold text-primary">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const data = viewMode === 'mensal' ? monthlyData : dailyData;
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

  // Calculate total for daily view
  const totalDiario = useMemo(() => {
    if (viewMode !== 'diario') return 0;
    return dailyData.reduce((acc, d) => acc + d.valor, 0);
  }, [dailyData, viewMode]);

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
            <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="nome"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: viewMode === 'diario' ? 10 : 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                interval={viewMode === 'diario' ? 1 : 0}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(value) => value >= 1000 ? `R$${value / 1000}k` : `R$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => {
                  let fill = 'hsl(var(--info))';
                  let opacity = 0.7;

                  if (viewMode === 'mensal') {
                    if (index === 0) {
                      fill = 'hsl(var(--primary))';
                      opacity = 1;
                    }
                  } else {
                    // Daily view
                    const dayEntry = entry as { status?: string };
                    switch (dayEntry.status) {
                      case 'hoje':
                        fill = 'hsl(var(--primary))';
                        opacity = 1;
                        break;
                      case 'atrasado':
                        fill = 'hsl(var(--destructive))';
                        opacity = 1;
                        break;
                      case 'passado':
                        fill = 'hsl(var(--muted-foreground))';
                        opacity = 0.5;
                        break;
                      default:
                        fill = 'hsl(var(--info))';
                        opacity = 0.7;
                    }
                  }

                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={fill} 
                      opacity={opacity}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {viewMode === 'diario' && (
          <div className="flex items-center justify-center gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span className="text-muted-foreground">Hoje</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-info opacity-70" />
              <span className="text-muted-foreground">A receber</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-destructive" />
              <span className="text-muted-foreground">Atrasado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-muted-foreground opacity-50" />
              <span className="text-muted-foreground">Passado</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}