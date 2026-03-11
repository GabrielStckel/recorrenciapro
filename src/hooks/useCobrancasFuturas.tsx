import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface CobrancaFutura {
  id: string;
  user_id: string;
  cliente_nome: string;
  whatsapp: string | null;
  valor_a_vista: number;
  data_envio_link: string;
  link_pagamento: string | null;
  produto: string | null;
  observacao: string | null;
  status: string; // PENDENTE | ENVIADO | CONVERTIDO
  created_at: string;
  updated_at: string;
}

export type CobrancaFuturaInsert = Omit<CobrancaFutura, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status'>;

export function useCobrancasFuturas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: cobrancas = [], isLoading } = useQuery({
    queryKey: ['cobrancas_futuras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas_futuras')
        .select('*')
        .order('data_envio_link', { ascending: true });
      if (error) throw error;
      return data as CobrancaFutura[];
    },
    enabled: !!user,
  });

  const addCobranca = useMutation({
    mutationFn: async (cobranca: CobrancaFuturaInsert) => {
      const { data, error } = await supabase
        .from('cobrancas_futuras')
        .insert({ ...cobranca, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas_futuras'] });
      toast({ title: 'Cobrança futura criada!' });
    },
    onError: (e: Error) => {
      toast({ title: 'Erro ao criar cobrança', description: e.message, variant: 'destructive' });
    },
  });

  const updateCobranca = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CobrancaFutura> & { id: string }) => {
      const { error } = await supabase
        .from('cobrancas_futuras')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas_futuras'] });
    },
  });

  const deleteCobranca = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cobrancas_futuras')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas_futuras'] });
      toast({ title: 'Cobrança removida' });
    },
  });

  const converterEmCliente = useMutation({
    mutationFn: async (cobranca: CobrancaFutura) => {
      // Mark as converted
      const { error } = await supabase
        .from('cobrancas_futuras')
        .update({ status: 'CONVERTIDO' })
        .eq('id', cobranca.id);
      if (error) throw error;
      return cobranca;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cobrancas_futuras'] });
      toast({ title: 'Cobrança marcada como convertida! Agora crie o cliente recorrente.' });
    },
  });

  return {
    cobrancas,
    isLoading,
    addCobranca,
    updateCobranca,
    deleteCobranca,
    converterEmCliente,
  };
}
