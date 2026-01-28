import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Produto {
  id: string;
  nome: string;
  created_at: string;
}

export function useProdutos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ['produtos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data as Produto[];
    },
  });

  const addProduto = useMutation({
    mutationFn: async (nome: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('produtos')
        .insert({ nome: nome.trim(), user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast({ title: 'Produto adicionado com sucesso!' });
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast({
          title: 'Erro',
          description: 'Este produto já existe.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro ao adicionar produto',
          description: error.message,
          variant: 'destructive',
        });
      }
    },
  });

  const deleteProduto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast({ title: 'Produto removido com sucesso!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao remover produto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    produtos,
    isLoading,
    addProduto,
    deleteProduto,
  };
}
