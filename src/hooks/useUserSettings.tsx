import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface UserSettings {
  id: string;
  user_id: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useUserSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Non-sensitive settings row (payment_pin is intentionally never selected).
  const { data: settings, isLoading } = useQuery({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('id, user_id, avatar_url, created_at, updated_at')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as UserSettings | null;
    },
    enabled: !!user,
  });

  // Whether a PIN is configured, resolved via SECURITY DEFINER RPC (no exposure of the PIN itself).
  const { data: hasPin = false } = useQuery({
    queryKey: ['user-settings', 'has-pin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('user_has_payment_pin');
      if (error) throw error;
      return Boolean(data);
    },
    enabled: !!user,
  });

  const createOrUpdatePin = useMutation({
    mutationFn: async (pin: string) => {
      const { error } = await supabase.rpc('set_payment_pin', { _pin: pin });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      toast({ title: 'PIN configurado com sucesso!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao configurar PIN',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Server-side verification; PIN is never returned to the client.
  const verifyPin = async (inputPin: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('verify_payment_pin', { _pin: inputPin });
    if (error) return false;
    return Boolean(data);
  };

  const avatarUrl = settings?.avatar_url || null;

  const updateAvatar = useMutation({
    mutationFn: async (url: string) => {
      if (settings) {
        const { error } = await supabase
          .from('user_settings')
          .update({ avatar_url: url })
          .eq('user_id', user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_settings')
          .insert({ user_id: user!.id, avatar_url: url });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      toast({ title: 'Avatar atualizado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar avatar', description: error.message, variant: 'destructive' });
    },
  });

  return {
    settings,
    isLoading,
    hasPin,
    avatarUrl,
    createOrUpdatePin,
    updateAvatar,
    verifyPin,
  };
}
