import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MovimentoParcela {
  id: string;
  cliente_id: string;
  tipo: 'INCREMENTO' | 'DECREMENTO' | 'AJUSTE';
  delta_parcelas: number;
  parcelas_antes: number;
  parcelas_depois: number;
  observacao: string | null;
  data_evento: string;
  created_at: string;
}

export function useMovimentos(clienteId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['movimentos', clienteId],
    queryFn: async () => {
      let query = supabase
        .from('movimentos_parcelas')
        .select('*')
        .order('data_evento', { ascending: false });

      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MovimentoParcela[];
    },
    enabled: !!user,
  });
}

export function useRegistrarMovimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (movimento: Omit<MovimentoParcela, 'id' | 'created_at' | 'data_evento'>) => {
      const { data, error } = await supabase
        .from('movimentos_parcelas')
        .insert(movimento)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['movimentos'] });
      queryClient.invalidateQueries({ queryKey: ['movimentos', variables.cliente_id] });
    },
  });
}
