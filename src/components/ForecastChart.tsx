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

    // Calculate forecast for each client
    clientes.forEach((cliente) => {
      if (cliente.parcelas_pendentes <= 0) return;

      let parcelasRestantes = cliente.parcelas_pendentes;
      const valorParcela = cliente.valor_parcela;

      // Start from next due date
      const dataInicio = new Date(cliente.data_inicio);
      let proximoVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), cliente.dia_vencimento);
      
      if (proximoVencimento <= hoje) {
        proximoVencimento.setMonth(proximoVencimento.getMonth() + 1);
      }

      for (let i = 0; i < 12 && parcelasRestantes > 0; i++) {
        const mesIndex = meses.findIndex(
          (m) => m.mes === proximoVencimento.getMonth() && m.ano === proximoVencimento.getFullYear()
        );
        
        if (mesIndex !== -1) {
          meses[mesIndex].valor += valorParcela;
          parcelasRestantes--;
        }
        
        proximoVencimento.setMonth(proximoVencimento.getMonth() + 1);
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