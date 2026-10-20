import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Cliente, HistoricoPagamento, ClienteCalculado, calcularDadosCliente } from '@/types/cliente';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

// Fire-and-forget sync to partner account (non-blocking)
async function sincronizarParceiro(clienteId: string, action: string, data: Record<string, unknown> = {}) {
  try {
    await supabase.functions.invoke('sincronizar-pagamento', {
      body: { cliente_id: clienteId, action, ...data },
    });
  } catch (e) {
    console.log('Sync partner failed (non-critical):', e);
  }
}

export function useClientes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
    mutationFn: async ({ id, previous, ...updates }: Partial<Cliente> & { id: string; previous?: Cliente }) => {
      const { data, error } = await supabase
        .from('clientes_parcelados')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Build diff-only sync payload; never sync payment/review state fields.
      const SYNCABLE = [
        'cliente_nome', 'whatsapp', 'produto', 'total_parcelas',
        'valor_parcela', 'valor_total', 'dia_vencimento', 'data_inicio',
        'status_cliente',
      ] as const;

      let prev = previous;
      if (!prev) {
        const { data: prevData } = await supabase
          .from('clientes_parcelados')
          .select('*')
          .eq('id', id)
          .single();
        prev = prevData as Cliente | undefined;
      }

      const syncPayload: Record<string, unknown> = {};
      for (const key of SYNCABLE) {
        if (key in updates) {
          const newVal = (updates as Record<string, unknown>)[key];
          const oldVal = prev ? (prev as unknown as Record<string, unknown>)[key] : undefined;
          if (newVal !== oldVal) syncPayload[key] = newVal;
        }
      }

      if (Object.keys(syncPayload).length > 0) {
        sincronizarParceiro(id, 'cliente_editado', syncPayload);
      }

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
      // Sincroniza a exclusão com o sócio ANTES de apagar: depois do delete o vínculo
      // some em cascata e a função não encontra mais o cliente do sócio.
      await sincronizarParceiro(id, 'cliente_deletado');

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
      // Chamada atômica: valida ownership, incrementa/decrementa, grava movimento e histórico numa única transação.
      const { data: clienteAtualizado, error: rpcError } = await supabase.rpc('registrar_pagamento_atomico', {
        p_cliente_id: clienteId,
        p_incremento: incremento,
        p_observacao: observacao ?? null,
        p_registrado_por: user?.email ?? null,
      });

      if (rpcError) throw rpcError;
      if (!clienteAtualizado) throw new Error('Cliente não encontrado');

      const clienteTyped = clienteAtualizado as unknown as Cliente;

      // Sync to partner (fire-and-forget)
      sincronizarParceiro(clienteId, incremento > 0 ? 'pagamento_confirmado' : 'pagamento_removido', {
        parcelas_pagas: clienteTyped.parcelas_pagas,
        data_ultimo_pagamento: clienteTyped.data_ultimo_pagamento,
      });

      return {
        novasParcelas: clienteTyped.parcelas_pagas,
        clienteAtualizado: calcularDadosCliente(clienteTyped),
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
      // Mesma função atômica do botão +1: incrementa, limpa a revisão, grava movimento e
      // histórico numa única transação (antes eram 3 gravações separadas que podiam ficar pela metade).
      const { data, error } = await supabase.rpc('registrar_pagamento_atomico', {
        p_cliente_id: clienteId,
        p_incremento: 1,
        p_observacao: observacao || 'Pagamento confirmado via revisão',
        p_registrado_por: user?.email ?? null,
      });

      if (error) throw error;
      if (!data) throw new Error('Cliente não encontrado');

      const clienteAtualizado = data as unknown as Cliente;

      // Sync to partner (fire-and-forget)
      sincronizarParceiro(clienteId, 'pagamento_confirmado', {
        parcelas_pagas: clienteAtualizado.parcelas_pagas,
        data_ultimo_pagamento: clienteAtualizado.data_ultimo_pagamento,
      });

      return { novasParcelas: clienteAtualizado.parcelas_pagas, clienteAtualizado: calcularDadosCliente(clienteAtualizado) };
    },
    onMutate: async ({ clienteId }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['clientes'] });

      const previousClientes = queryClient.getQueryData<ClienteCalculado[]>(['clientes']);

      // Optimistically remove from review immediately
      const now = new Date();
      queryClient.setQueryData<ClienteCalculado[]>(['clientes'], (old) => {
        if (!old) return old;
        return old.map((c) => {
          if (c.id !== clienteId) return c;
          return calcularDadosCliente({
            ...(c as unknown as Cliente),
            parcelas_pagas: Math.min(c.total_parcelas, c.parcelas_pagas + 1),
            data_ultimo_pagamento: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
            em_revisao: false,
            mes_referencia_revisao: null,
            valor_pago_parcial: null,
            observacao_revisao: null,
          });
        });
      });

      return { previousClientes };
    },
    onSuccess: (result) => {
      // Update cache with server-confirmed data
      if (result?.clienteAtualizado) {
        queryClient.setQueryData<ClienteCalculado[]>(['clientes'], (old) => {
          if (!old) return old;
          return old.map((c) => (c.id === result.clienteAtualizado.id ? result.clienteAtualizado : c));
        });
      }
      // Only invalidate historico/movimentos, NOT clientes (we already have fresh data)
      queryClient.invalidateQueries({ queryKey: ['historico'] });
      queryClient.invalidateQueries({ queryKey: ['movimentos'] });
      queryClient.invalidateQueries({ queryKey: ['all-movimentos'] });
      toast({ title: 'Pagamento confirmado!', description: 'Parcela marcada como paga.' });
    },
    onError: (error, _vars, context) => {
      // Rollback on error
      if (context?.previousClientes) {
        queryClient.setQueryData(['clientes'], context.previousClientes);
      }
      toast({ title: 'Erro ao confirmar pagamento', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation to mark as not paid (late)
  const marcarComoAtrasado = useMutation({
    mutationFn: async ({ clienteId }: { clienteId: string }) => {
      const hoje = new Date();
      const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

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

      // Sync to partner (fire-and-forget)
      sincronizarParceiro(clienteId, 'marcado_atrasado');

      return { clienteId, mesAtual };
    },
    onMutate: async ({ clienteId }) => {
      await queryClient.cancelQueries({ queryKey: ['clientes'] });
      const previousClientes = queryClient.getQueryData<ClienteCalculado[]>(['clientes']);

      const hoje = new Date();
      const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      queryClient.setQueryData<ClienteCalculado[]>(['clientes'], (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === clienteId
            ? calcularDadosCliente({
                ...(c as unknown as Cliente),
                em_revisao: false,
                mes_referencia_revisao: mesAtual,
                valor_pago_parcial: null,
                observacao_revisao: null,
              })
            : c
        );
      });

      return { previousClientes };
    },
    onSuccess: () => {
      // Don't invalidate clientes - optimistic update is sufficient
      toast({ title: 'Cliente marcado como atrasado', variant: 'destructive' });
    },
    onError: (error, _vars, context) => {
      if (context?.previousClientes) {
        queryClient.setQueryData(['clientes'], context.previousClientes);
      }
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

      // Sync to partner
      sincronizarParceiro(clienteId, 'entrou_revisao', { mes_referencia: mesReferencia });
      return { clienteId, mesReferencia };
    },
    onMutate: async ({ clienteId, mesReferencia }) => {
      // Optimistically set em_revisao without triggering refetch
      queryClient.setQueryData<ClienteCalculado[]>(['clientes'], (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === clienteId
            ? calcularDadosCliente({
                ...(c as unknown as Cliente),
                em_revisao: true,
                mes_referencia_revisao: mesReferencia,
              })
            : c
        );
      });
    },
    // Don't invalidate on success - optimistic update is enough
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

      // Sync to partner
      sincronizarParceiro(clienteId, 'pagamento_parcial', {
        valor_pago_parcial: valorPagoParcial,
        observacao_revisao: observacao,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ title: 'Pagamento parcial registrado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao registrar pagamento parcial', description: error.message, variant: 'destructive' });
    },
  });

  // Regra do sistema: um cliente só sai de "Em revisão" pelos botões "Pagou" / "Não pagou"
  // (ou por um +1). Não existe saída automática — ver .lovable/plan.md.

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