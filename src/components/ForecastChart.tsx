import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClienteCalculado } from '@/types/cliente';
import { Calendar, TrendingUp } from 'lucide-react';

interface ForecastChartProps {
  clientes: ClienteCalculado[];
}

type ViewMode = 'mensal' | 'diario';

export function ForecastChart({ clientes }: ForecastChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('mensal');

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

  // Daily forecast data for current month
  const dailyData = useMemo(() => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const ultimoDiaMes = new Date(anoAtual, mesAtual + 1, 0).getDate();

    // Initialize all days of the month
    const dias: { nome: string; valor: number; dia: number; passado: boolean; hoje: boolean }[] = [];
    for (let d = 1; d <= ultimoDiaMes; d++) {
      dias.push({
        nome: d.toString().padStart(2, '0'),
        valor: 0,
        dia: d,
        passado: d < hoje.getDate(),
        hoje: d === hoje.getDate(),
      });
    }

    // Calculate expected payments per day
    clientes.forEach((cliente) => {
      if (cliente.status_cliente !== 'ATIVO') return;
      if (cliente.parcelas_pendentes <= 0) return;

      // Check if client already paid this month
      if (cliente.data_ultimo_pagamento) {
        const [ano, mes] = cliente.data_ultimo_pagamento.split('-').map(Number);
        if (ano === anoAtual && mes - 1 === mesAtual) {
          return; // Already paid this month
        }
      }

      // Get the due day adjusted for month length
      const diaVencimento = Math.min(cliente.dia_vencimento, ultimoDiaMes);
      const diaIndex = diaVencimento - 1;

      if (diaIndex >= 0 && diaIndex < dias.length) {
        dias[diaIndex].valor += cliente.valor_parcela;
      }
    });

    return dias;
  }, [clientes]);

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
  const hoje = new Date();
  const nomeMes = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg">
            {viewMode === 'mensal' 
              ? 'Previsão de Faturamento (12 meses)' 
              : `Previsão do Mês (${nomeMes})`
            }
          </CardTitle>
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
                tickFormatter={(value) => `R$${value / 1000}k`}
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
                    const dayEntry = entry as { passado?: boolean; hoje?: boolean };
                    if (dayEntry.hoje) {
                      fill = 'hsl(var(--primary))';
                      opacity = 1;
                    } else if (dayEntry.passado) {
                      fill = 'hsl(var(--muted-foreground))';
                      opacity = 0.4;
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
      </CardContent>
    </Card>
  );
}