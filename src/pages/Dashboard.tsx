import { useState, useMemo, useEffect, useRef } from 'react';
import { useClientes } from '@/hooks/useClientes';
import { Layout } from '@/components/Layout';
import { KPICard } from '@/components/KPICard';
import { ForecastChart } from '@/components/ForecastChart';
import { ClientesAtrasados } from '@/components/ClientesAtrasados';
import { PagamentosEmRevisao } from '@/components/PagamentosEmRevisao';
import { MinhaEvolucao } from '@/components/MinhaEvolucao';
import { DollarSign, TrendingUp, AlertTriangle, Clock, Loader2, Filter, Calendar, CheckCircle, Eye, EyeOff } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { clientes, isLoading, entrarEmRevisao } = useClientes();
  const [selectedProduto, setSelectedProduto] = useState<string>('Todos');
  const [hideValues, setHideValues] = useState<boolean>(false);

  const formatCurrency = (value: number) => {
    if (hideValues) return '••••••';
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

  // Track which clients we've already sent to review (to avoid repeated mutations)
  const clientesRevisadosRef = useRef<Set<string>>(new Set());
  // Stable reference to entrarEmRevisao.mutate to avoid re-running effect
  const entrarEmRevisaoMutate = useRef(entrarEmRevisao.mutate);
  entrarEmRevisaoMutate.current = entrarEmRevisao.mutate;

  // Auto-enter review state for clients that need it (run only once per client)
  useEffect(() => {
    if (clientes.length === 0) return;

    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    const parseDateOnlyISO = (dateStr: string): Date => {
      const [ano, mes, dia] = dateStr.split('-').map(Number);
      return new Date(ano, mes - 1, dia);
    };

    clientes.forEach((cliente) => {
      // Only ATIVO clients with pending parcels
      if (cliente.status_cliente !== 'ATIVO' || cliente.parcelas_pendentes === 0) return;

      // Se já está em revisão, não mexe
      if (cliente.em_revisao) return;

      // Se já foi revisado/processado neste mês (marcado como não pagou), não mexe
      if (cliente.mes_referencia_revisao === mesAtual) return;

      // Se já enviamos mutação para este cliente nesta sessão, não envia de novo
      if (clientesRevisadosRef.current.has(cliente.id)) return;

      // Só entra em revisão se o vencimento do mês atual já passou e ainda não pagou neste mês
      if (hoje.getTime() < cliente.data_vencimento_mes_atual.getTime()) return;

      const ultimoPagamento = cliente.data_ultimo_pagamento ? parseDateOnlyISO(cliente.data_ultimo_pagamento) : null;
      const pagouNesteMes = ultimoPagamento
        ? ultimoPagamento.getMonth() === hoje.getMonth() && ultimoPagamento.getFullYear() === hoje.getFullYear()
        : false;

      if (!pagouNesteMes) {
        clientesRevisadosRef.current.add(cliente.id);
        entrarEmRevisaoMutate.current({ clienteId: cliente.id, mesReferencia: mesAtual });
      }
    });
  }, [clientes]); // Remove entrarEmRevisao from deps - use ref instead

  const totalRecebido = clientesFiltrados.reduce((acc, c) => acc + c.valor_pago, 0);
  const totalAReceber = clientesFiltrados.reduce((acc, c) => acc + c.valor_a_receber, 0);
  const clientesAtrasados = clientesFiltrados.filter((c) => c.status === 'Atrasado');
  const clientesEmRevisao = clientesFiltrados.filter((c) => c.em_revisao && c.status_cliente === 'ATIVO');
  const valorEmAtraso = clientesAtrasados.reduce((acc, c) => acc + c.valor_parcela, 0);

  // Helpers para cálculos do mês
  const parseDateOnlyISO = (dateStr: string): Date => {
    const [ano, mes, dia] = dateStr.split('-').map(Number);
    return new Date(ano, mes - 1, dia);
  };

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  // Recebido no mês atual: clientes que pagaram neste mês
  const recebidoNoMes = useMemo(() => {
    return clientesFiltrados
      .filter((c) => {
        if (!c.data_ultimo_pagamento) return false;
        const ultimoPagamento = parseDateOnlyISO(c.data_ultimo_pagamento);
        return ultimoPagamento.getMonth() === mesAtual && ultimoPagamento.getFullYear() === anoAtual;
      })
      .reduce((acc, c) => acc + c.valor_parcela, 0);
  }, [clientesFiltrados, mesAtual, anoAtual]);

  // A receber no mês atual: clientes ATIVOS com parcelas pendentes que ainda NÃO pagaram neste mês
  const aReceberNoMes = useMemo(() => {
    return clientesFiltrados
      .filter((c) => {
        // Somente ATIVOS com parcelas pendentes
        if (c.status_cliente !== 'ATIVO' || c.parcelas_pendentes <= 0) return false;

        // Verificar se já pagou neste mês
        if (c.data_ultimo_pagamento) {
          const ultimoPagamento = parseDateOnlyISO(c.data_ultimo_pagamento);
          if (ultimoPagamento.getMonth() === mesAtual && ultimoPagamento.getFullYear() === anoAtual) {
            return false; // Já pagou neste mês
          }
        }
        return true;
      })
      .reduce((acc, c) => acc + c.valor_parcela, 0);
  }, [clientesFiltrados, mesAtual, anoAtual]);

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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHideValues(!hideValues)}
              className="h-9 w-9"
              title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            >
              {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
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
            title="Recebido no mês" 
            value={formatCurrency(recebidoNoMes)} 
            subtitle="Mês atual"
            icon={CheckCircle} 
            variant="success" 
          />
          <KPICard 
            title="A receber no mês" 
            value={formatCurrency(aReceberNoMes)} 
            subtitle="Mês atual"
            icon={Calendar} 
            variant={aReceberNoMes > 0 ? 'default' : 'success'} 
          />
          <KPICard title="Clientes Atrasados" value={clientesAtrasados.length.toString()} icon={AlertTriangle} variant={clientesAtrasados.length > 0 ? 'destructive' : 'default'} />
          <KPICard title="Valor em Atraso" value={formatCurrency(valorEmAtraso)} icon={Clock} variant={valorEmAtraso > 0 ? 'warning' : 'default'} />
        </div>

        {/* Review Section */}
        {clientesEmRevisao.length > 0 && (
          <PagamentosEmRevisao clientes={clientesFiltrados} />
        )}

        {/* Evolution Card */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <MinhaEvolucao totalRecebido={totalRecebido} hideValues={hideValues} />
          </div>
          <div className="lg:col-span-2">
            <ForecastChart clientes={clientesFiltrados} hideValues={hideValues} />
          </div>
          <div className="lg:col-span-1">
            <ClientesAtrasados clientes={clientesFiltrados} hideValues={hideValues} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
