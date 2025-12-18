import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Cliente, HistoricoPagamento, ClienteCalculado, calcularDadosCliente } from '@/types/cliente';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

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
    mutationFn: async ({ clienteId, incremento }: { clienteId: string; incremento: number }) => {
      // Get current client data
      const { data: cliente, error: fetchError } = await supabase
        .from('clientes_parcelados')
        .select('*')
        .eq('id', clienteId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const novasParcelas = Math.max(0, Math.min(cliente.total_parcelas, cliente.parcelas_pagas + incremento));
      
      // Update client
      const { error: updateError } = await supabase
        .from('clientes_parcelados')
        .update({
          parcelas_pagas: novasParcelas,
          data_ultimo_pagamento: incremento > 0 ? new Date().toISOString().split('T')[0] : cliente.data_ultimo_pagamento,
        })
        .eq('id', clienteId);
      
      if (updateError) throw updateError;
      
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
      
      return { novasParcelas };
    },
    onSuccess: (_, { incremento }) => {
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

  return {
    clientes,
    isLoading,
    error,
    addCliente,
    updateCliente,
    deleteCliente,
    registrarPagamento,
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