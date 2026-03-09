import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Cliente, HistoricoPagamento, ClienteCalculado, calcularDadosCliente } from '@/types/cliente';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useRegistrarMovimento } from './useMovimentos';

export function useClientes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const registrarMovimento = useRegistrarMovimento();

  const { data: clientes = [], isLoading, error } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes_parcelados')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data as Cliente[]).map(calcularDadosCliente);
    },
    enabled: !!user,
  });

  const addCliente = useMutation({
    mutationFn: async (cliente: Omit<Cliente, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('clientes_parcelados')
        .insert({ ...cliente, user_id: user!.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ title: 'Cliente adicionado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao adicionar cliente', description: error.message, variant: 'destructive' });
    },
  });

  const updateCliente = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Cliente> & { id: string }) => {
      const { data, error } = await supabase
        .from('clientes_parcelados')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar cliente', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCliente = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clientes_parcelados')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ title: 'Cliente removido com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover cliente', description: error.message, variant: 'destructive' });
    },
  });

  const registrarPagamento = useMutation({
    mutationFn: async ({ clienteId, incremento, observacao }: { clienteId: string; incremento: number; observacao?: string }) => {
      const parseDateOnlyISO = (dateStr: string) => {
        const [ano, mes, dia] = dateStr.split('-').map(Number);
        return new Date(ano, mes - 1, dia);
      };

      const formatDateOnlyISO = (date: Date) => {
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
      };

      const subMonthsClampedISO = (dateStr: string, months: number) => {
        const base = parseDateOnlyISO(dateStr);
        const alvo = new Date(base.getFullYear(), base.getMonth() - months, 1);
        const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
        const dia = Math.min(base.getDate(), ultimoDia);
        return formatDateOnlyISO(new Date(alvo.getFullYear(), alvo.getMonth(), dia));
      };

      const isSameMonthYear = (a: Date, b: Date) => a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

      // Get current client data
      const { data: cliente, error: fetchError } = await supabase
        .from('clientes_parcelados')
        .select('*')
        .eq('id', clienteId)
        .single();

      if (fetchError) throw fetchError;

      const parcelasAntes = cliente.parcelas_pagas;
      const novasParcelas = Math.max(0, Math.min(cliente.total_parcelas, cliente.parcelas_pagas + incremento));

      // Calcular nova data_ultimo_pagamento
      let novaDataUltimoPagamento: string | null = cliente.data_ultimo_pagamento;

      // Flags de atualização para revisão
      let limparRevisao = false;

      if (incremento > 0) {
        // +1 parcela: define data como hoje (data local)
        novaDataUltimoPagamento = formatDateOnlyISO(new Date());
        // Ao pagar, sair do estado de revisão
        limparRevisao = true;
      } else if (incremento < 0 && cliente.parcelas_pagas > 0) {
        // -1 parcela: só desfaz confirmação se o último pagamento estiver no mês atual
        if (cliente.data_ultimo_pagamento) {
          const hoje = new Date();
          const ultimoPagamento = parseDateOnlyISO(cliente.data_ultimo_pagamento);

          if (isSameMonthYear(ultimoPagamento, hoje)) {
            novaDataUltimoPagamento = subMonthsClampedISO(cliente.data_ultimo_pagamento, 1);
          }
        }

        // Se novasParcelas volta a 0, limpar a data
        if (novasParcelas === 0) {
          novaDataUltimoPagamento = null;
        }
      }

      // Preparar dados de update
      const updateData: Record<string, unknown> = {
        parcelas_pagas: novasParcelas,
        data_ultimo_pagamento: novaDataUltimoPagamento,
      };

      if (limparRevisao) {
        updateData.em_revisao = false;
        updateData.mes_referencia_revisao = null;
        updateData.valor_pago_parcial = null;
        updateData.observacao_revisao = null;
      }

      // Update client (retorna o registro atualizado para atualizar o cache)
      const { data: clienteAtualizado, error: updateError } = await supabase
        .from('clientes_parcelados')
        .update(updateData)
        .eq('id', clienteId)
        .select('*')
        .single();

      if (updateError) throw updateError;

      // Registrar movimento
      const tipoMovimento = incremento > 0 ? 'INCREMENTO' : 'DECREMENTO';
      await registrarMovimento.mutateAsync({
        cliente_id: clienteId,
        tipo: tipoMovimento,
        delta_parcelas: incremento,
        parcelas_antes: parcelasAntes,
        parcelas_depois: novasParcelas,
        observacao: observacao || null,
      });

      // Add to payment history if incrementing
      if (incremento > 0) {
        const valorParcela = cliente.valor_total / cliente.total_parcelas;
        const { error: histError } = await supabase
          .from('historico_pagamentos')
          .insert({
            cliente_id: clienteId,
            valor_pago: valorParcela,
            numero_parcela: novasParcelas,
            registrado_por: user?.email,
          });

        if (histError) throw histError;
      }

      return {
        novasParcelas,
        clienteAtualizado: calcularDadosCliente(clienteAtualizado as Cliente),
      };
    },
    onSuccess: (result, { incremento }) => {
      // Atualiza o cache local imediatamente (status/dias recalculados)
      if (result?.clienteAtualizado) {
        queryClient.setQueryData(['clientes'], (old: ClienteCalculado[] | undefined) => {
          if (!old) return old;
          return old.map((c) => (c.id === result.clienteAtualizado.id ? result.clienteAtualizado : c));
        });
      }

      // Garante refetch
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['historico'] });
      toast({
        title: incremento > 0 ? 'Pagamento registrado!' : 'Parcela removida',
        description: incremento > 0 ? 'Parcela marcada como paga com sucesso.' : 'Parcela removida com sucesso.',
      });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar pagamento', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation to confirm payment from review
  const confirmarPagamentoRevisao = useMutation({
    mutationFn: async ({ clienteId, observacao }: { clienteId: string; observacao?: string }) => {
      // Get current client data
      const { data: cliente, error: fetchError } = await supabase
        .from('clientes_parcelados')
        .select('*')
        .eq('id', clienteId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const parcelasAntes = cliente.parcelas_pagas;
      const novasParcelas = Math.min(cliente.total_parcelas, cliente.parcelas_pagas + 1);
      const now = new Date();
      const novaDataUltimoPagamento = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      // Update client: increment parcela, clear review state
      const { error: updateError } = await supabase
        .from('clientes_parcelados')
        .update({
          parcelas_pagas: novasParcelas,
          data_ultimo_pagamento: novaDataUltimoPagamento,
          em_revisao: false,
          mes_referencia_revisao: null,
          valor_pago_parcial: null,
          observacao_revisao: null,
        })
        .eq('id', clienteId);
      
      if (updateError) throw updateError;
      
      // Registrar movimento
      await registrarMovimento.mutateAsync({
        cliente_id: clienteId,
        tipo: 'INCREMENTO',
        delta_parcelas: 1,
        parcelas_antes: parcelasAntes,
        parcelas_depois: novasParcelas,
        observacao: observacao || 'Pagamento confirmado via revisão',
      });
      
      // Add to payment history
      const valorParcela = cliente.valor_total / cliente.total_parcelas;
      const { error: histError } = await supabase
        .from('historico_pagamentos')
        .insert({
          cliente_id: clienteId,
          valor_pago: valorParcela,
          numero_parcela: novasParcelas,
          registrado_por: user?.email,
        });
      
      if (histError) throw histError;
      
      return { novasParcelas };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['historico'] });
      toast({ title: 'Pagamento confirmado!', description: 'Parcela marcada como paga.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao confirmar pagamento', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation to mark as not paid (late)
  const marcarComoAtrasado = useMutation({
    mutationFn: async ({ clienteId }: { clienteId: string }) => {
      const hoje = new Date();
      const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

      // Sai da revisão e marca o mês como "processado" (evita reentrar em revisão automaticamente)
      const { error: updateError } = await supabase
        .from('clientes_parcelados')
        .update({
          em_revisao: false,
          mes_referencia_revisao: mesAtual,
          valor_pago_parcial: null,
          observacao_revisao: null,
        })
        .eq('id', clienteId);

      if (updateError) throw updateError;

      return { clienteId, mesAtual };
    },
    onSuccess: (result) => {
      // Atualiza cache imediatamente para remover do painel de revisão
      if (result?.clienteId) {
        queryClient.setQueryData(['clientes'], (old: ClienteCalculado[] | undefined) => {
          if (!old) return old;
          return old.map((c) =>
            c.id === result.clienteId
              ? calcularDadosCliente({
                  ...(c as unknown as Cliente),
                  em_revisao: false,
                  mes_referencia_revisao: result.mesAtual,
                })
              : c
          );
        });
      }

      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ title: 'Cliente marcado como atrasado', variant: 'destructive' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation to enter review state (silent - no toast on error to avoid repeated messages)
  const entrarEmRevisao = useMutation({
    mutationFn: async ({ clienteId, mesReferencia }: { clienteId: string; mesReferencia: string }) => {
      const { error } = await supabase
        .from('clientes_parcelados')
        .update({
          em_revisao: true,
          mes_referencia_revisao: mesReferencia,
        })
        .eq('id', clienteId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });

  // Mutation to register partial payment
  const registrarPagamentoParcial = useMutation({
    mutationFn: async ({ clienteId, valorPagoParcial, observacao }: { clienteId: string; valorPagoParcial: number; observacao: string | null }) => {
      const { error } = await supabase
        .from('clientes_parcelados')
        .update({
          valor_pago_parcial: valorPagoParcial,
          observacao_revisao: observacao,
        })
        .eq('id', clienteId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ title: 'Pagamento parcial registrado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao registrar pagamento parcial', description: error.message, variant: 'destructive' });
    },
  });

  return {
    clientes,
    isLoading,
    error,
    addCliente,
    updateCliente,
    deleteCliente,
    registrarPagamento,
    confirmarPagamentoRevisao,
    marcarComoAtrasado,
    entrarEmRevisao,
    registrarPagamentoParcial,
  };
}

export function useHistorico(clienteId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['historico', clienteId],
    queryFn: async () => {
      let query = supabase
        .from('historico_pagamentos')
        .select('*')
        .order('data_pagamento', { ascending: false });
      
      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as HistoricoPagamento[];
    },
    enabled: !!user,
  });
}