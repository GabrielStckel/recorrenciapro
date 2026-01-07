import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClienteCalculado } from '@/types/cliente';

interface ForecastChartProps {
  clientes: ClienteCalculado[];
}

export function ForecastChart({ clientes }: ForecastChartProps) {
  const data = useMemo(() => {
    const hoje = new Date();
    const meses: { nome: string; valor: number; mes: number; ano: number }[] = [];

    // Generate next 12 months
    for (let i = 0; i < 12; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      meses.push({
        nome: data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        valor: 0,
        mes: data.getMonth(),
        ano: data.getFullYear(),
      });
    }

    // Calculate forecast for each client (only ATIVO clients)
    clientes.forEach((cliente) => {
      if (cliente.parcelas_pendentes <= 0 || cliente.status_cliente !== 'ATIVO') return;

      let parcelasRestantes = cliente.parcelas_pendentes;
      const valorParcela = cliente.valor_parcela;

      const getDueDate = (year: number, month: number) => {
        const base = new Date(year, month, 1); // normaliza mês/ano
        const y = base.getFullYear();
        const m = base.getMonth();
        const lastDay = new Date(y, m + 1, 0).getDate();
        const dia = Math.min(cliente.dia_vencimento, lastDay);
        return new Date(y, m, dia);
      };

      // Próximo vencimento (sem "drift" de setMonth quando dia=29/30/31)
      let proximoVencimento = getDueDate(hoje.getFullYear(), hoje.getMonth());
      if (proximoVencimento.getTime() <= hoje.getTime()) {
        proximoVencimento = getDueDate(hoje.getFullYear(), hoje.getMonth() + 1);
      }

      for (let i = 0; i < 12 && parcelasRestantes > 0; i++) {
        const due = getDueDate(proximoVencimento.getFullYear(), proximoVencimento.getMonth() + i);

        const mesIndex = meses.findIndex((m) => m.mes === due.getMonth() && m.ano === due.getFullYear());

        if (mesIndex !== -1) {
          meses[mesIndex].valor += valorParcela;
          parcelasRestantes--;
        }
      }
    });

    return meses;
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
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-lg font-bold text-primary">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-lg">Previsão de Faturamento (12 meses)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="nome"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(value) => `R$${value / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--info))'} 
                    opacity={index === 0 ? 1 : 0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}