import { useState, useMemo, useEffect } from 'react';
import { useClientes } from '@/hooks/useClientes';
import { Layout } from '@/components/Layout';
import { KPICard } from '@/components/KPICard';
import { ForecastChart } from '@/components/ForecastChart';
import { ClientesAtrasados } from '@/components/ClientesAtrasados';
import { PagamentosEmRevisao } from '@/components/PagamentosEmRevisao';
import { DollarSign, TrendingUp, AlertTriangle, Clock, Loader2, Filter, Eye, Calendar } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Dashboard() {
  const { clientes, isLoading, entrarEmRevisao } = useClientes();
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

  // Auto-enter review state for clients that need it
  useEffect(() => {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    const parseDateOnlyISO = (dateStr: string): Date => {
      const [ano, mes, dia] = dateStr.split('-').map(Number);
      return new Date(ano, mes - 1, dia);
    };

    clientes.forEach((cliente) => {
      // Only ATIVO clients with pending parcels
      if (cliente.status_cliente !== 'ATIVO' || cliente.parcelas_pendentes === 0) return;

      // Se já foi revisado/processado neste mês (em revisão OU marcado como não pagou), não mexe
      if (cliente.mes_referencia_revisao === mesAtual) return;

      // Só entra em revisão se o vencimento do mês atual já passou e ainda não pagou neste mês
      if (hoje.getTime() < cliente.data_vencimento_mes_atual.getTime()) return;

      const ultimoPagamento = cliente.data_ultimo_pagamento ? parseDateOnlyISO(cliente.data_ultimo_pagamento) : null;
      const pagouNesteMes = ultimoPagamento
        ? ultimoPagamento.getMonth() === hoje.getMonth() && ultimoPagamento.getFullYear() === hoje.getFullYear()
        : false;

      if (!pagouNesteMes) {
        entrarEmRevisao.mutate({ clienteId: cliente.id, mesReferencia: mesAtual });
      }
    });
  }, [clientes, entrarEmRevisao]);

  const totalRecebido = clientesFiltrados.reduce((acc, c) => acc + c.valor_pago, 0);
  const totalAReceber = clientesFiltrados.reduce((acc, c) => acc + c.valor_a_receber, 0);
  const clientesAtrasados = clientesFiltrados.filter((c) => c.status === 'Atrasado');
  const clientesEmRevisao = clientesFiltrados.filter((c) => c.em_revisao && c.status_cliente === 'ATIVO');
  const valorEmAtraso = clientesAtrasados.reduce((acc, c) => acc + c.valor_parcela, 0);

  // A receber no mês atual: clientes ATIVOS com parcelas pendentes que ainda NÃO pagaram neste mês
  const aReceberNoMes = useMemo(() => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    return clientesFiltrados
      .filter((c) => {
        // Somente ATIVOS com parcelas pendentes
        if (c.status_cliente !== 'ATIVO' || c.parcelas_pendentes <= 0) return false;

        // Verificar se já pagou neste mês
        if (c.data_ultimo_pagamento) {
          const ultimoPagamento = new Date(`${c.data_ultimo_pagamento}T00:00:00`);
          if (ultimoPagamento.getMonth() === mesAtual && ultimoPagamento.getFullYear() === anoAtual) {
            return false; // Já pagou neste mês
          }
        }
        return true;
      })
      .reduce((acc, c) => acc + c.valor_parcela, 0);
  }, [clientesFiltrados]);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <KPICard title="Total Recebido" value={formatCurrency(totalRecebido)} icon={DollarSign} variant="success" />
          <KPICard title="Total a Receber" value={formatCurrency(totalAReceber)} icon={TrendingUp} />
          <KPICard 
            title="A receber no mês" 
            value={formatCurrency(aReceberNoMes)} 
            subtitle="Mês atual"
            icon={Calendar} 
            variant={aReceberNoMes > 0 ? 'default' : 'success'} 
          />
          <KPICard title="Em Revisão" value={clientesEmRevisao.length.toString()} icon={Eye} variant={clientesEmRevisao.length > 0 ? 'warning' : 'default'} />
          <KPICard title="Clientes Atrasados" value={clientesAtrasados.length.toString()} icon={AlertTriangle} variant={clientesAtrasados.length > 0 ? 'destructive' : 'default'} />
          <KPICard title="Valor em Atraso" value={formatCurrency(valorEmAtraso)} icon={Clock} variant={valorEmAtraso > 0 ? 'warning' : 'default'} />
        </div>

        {/* Review Section */}
        {clientesEmRevisao.length > 0 && (
          <PagamentosEmRevisao clientes={clientesFiltrados} />
        )}

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
