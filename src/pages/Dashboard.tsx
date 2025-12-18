import { useClientes } from '@/hooks/useClientes';
import { Layout } from '@/components/Layout';
import { KPICard } from '@/components/KPICard';
import { ForecastChart } from '@/components/ForecastChart';
import { ClientesAtrasados } from '@/components/ClientesAtrasados';
import { DollarSign, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { clientes, isLoading } = useClientes();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const totalRecebido = clientes.reduce((acc, c) => acc + c.valor_pago, 0);
  const totalAReceber = clientes.reduce((acc, c) => acc + c.valor_a_receber, 0);
  const clientesAtrasados = clientes.filter((c) => c.status === 'Atrasado');
  const valorEmAtraso = clientesAtrasados.reduce((acc, c) => acc + c.valor_parcela, 0);

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
        <h1 className="text-2xl font-bold">Dashboard</h1>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total Recebido" value={formatCurrency(totalRecebido)} icon={DollarSign} variant="success" />
          <KPICard title="Total a Receber" value={formatCurrency(totalAReceber)} icon={TrendingUp} />
          <KPICard title="Clientes Atrasados" value={clientesAtrasados.length.toString()} icon={AlertTriangle} variant={clientesAtrasados.length > 0 ? 'destructive' : 'default'} />
          <KPICard title="Valor em Atraso" value={formatCurrency(valorEmAtraso)} icon={Clock} variant={valorEmAtraso > 0 ? 'warning' : 'default'} />
        </div>

        {/* Chart and Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ForecastChart clientes={clientes} />
          </div>
          <div>
            <ClientesAtrasados clientes={clientes} />
          </div>
        </div>
      </div>
    </Layout>
  );
}