import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface UserSettings {
  id: string;
  user_id: string;
  payment_pin: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useUserSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as UserSettings | null;
    },
    enabled: !!user,
  });

  const createOrUpdatePin = useMutation({
    mutationFn: async (pin: string) => {
      if (settings) {
        // Update existing
        const { error } = await supabase
          .from('user_settings')
          .update({ payment_pin: pin })
          .eq('user_id', user!.id);
        
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('user_settings')
          .insert({ user_id: user!.id, payment_pin: pin });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      toast({ title: 'PIN configurado com sucesso!' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erro ao configurar PIN', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const verifyPin = (inputPin: string): boolean => {
    if (!settings?.payment_pin) return true; // No PIN set, allow
    return settings.payment_pin === inputPin;
  };

  const hasPin = !!settings?.payment_pin;
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
