import { useState, useMemo } from 'react';
import { useClientes } from '@/hooks/useClientes';
import { Layout } from '@/components/Layout';
import { KPICard } from '@/components/KPICard';
import { ForecastChart } from '@/components/ForecastChart';
import { ClientesAtrasados } from '@/components/ClientesAtrasados';
import { DollarSign, TrendingUp, AlertTriangle, Clock, Loader2, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Dashboard() {
  const { clientes, isLoading } = useClientes();
  const [selectedProduto, setSelectedProduto] = useState<string>('Todos');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Get unique products
  const produtos = useMemo(() => {
    const uniqueProdutos = [...new Set(clientes.map((c) => c.produto))].filter(Boolean).sort();
    return ['Todos', ...uniqueProdutos];
  }, [clientes]);

  // Filter clients based on selected product
  const clientesFiltrados = useMemo(() => {
    if (selectedProduto === 'Todos') return clientes;
    return clientes.filter((c) => c.produto === selectedProduto);
  }, [clientes, selectedProduto]);

  const totalRecebido = clientesFiltrados.reduce((acc, c) => acc + c.valor_pago, 0);
  const totalAReceber = clientesFiltrados.reduce((acc, c) => acc + c.valor_a_receber, 0);
  const clientesAtrasados = clientesFiltrados.filter((c) => c.status === 'Atrasado');
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedProduto} onValueChange={setSelectedProduto}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por produto" />
              </SelectTrigger>
              <SelectContent>
                {produtos.map((produto) => (
                  <SelectItem key={produto} value={produto}>
                    {produto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedProduto !== 'Todos' && (
          <p className="text-sm text-muted-foreground">
            Exibindo: <span className="font-medium text-foreground">{selectedProduto}</span>
          </p>
        )}

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
            <ForecastChart clientes={clientesFiltrados} />
          </div>
          <div>
            <ClientesAtrasados clientes={clientesFiltrados} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
