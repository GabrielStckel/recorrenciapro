import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserSettings } from '@/hooks/useUserSettings';
import { SetupPinDialog } from '@/components/SetupPinDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Lock, ShieldCheck, Mail, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const AVATARS = [
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Leo',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Sophia',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Jack',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Luna',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Felix',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Mia',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Oscar',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Lily',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Max',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Chloe',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Sam',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Zoe',
];

export default function Perfil() {
  const { user } = useAuth();
  const { hasPin, avatarUrl, createOrUpdatePin, updateAvatar } = useUserSettings();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const handlePinConfirm = (pin: string) => {
    createOrUpdatePin.mutate(pin);
    setPinDialogOpen(false);
  };

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Meu Perfil</h1>

        {/* Info do usuário */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Informações da Conta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar className="w-10 h-10">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
                <AvatarFallback className="text-sm bg-primary/20 text-primary font-semibold">
                  {user?.email?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">E-mail</p>
                <p className="text-sm font-medium">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avatar Selection */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Escolher Avatar</CardTitle>
            <CardDescription>Selecione um avatar para o seu perfil.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {AVATARS.map((url) => {
                const isSelected = avatarUrl === url;
                return (
                  <button
                    key={url}
                    onClick={() => updateAvatar.mutate(url)}
                    className={cn(
                      "relative rounded-xl p-1.5 border-2 transition-all duration-200 hover:scale-105",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-md"
                        : "border-transparent hover:border-muted-foreground/30 bg-muted/30"
                    )}
                    disabled={updateAvatar.isPending}
                  >
                    <Avatar className="w-full h-auto aspect-square">
                      <AvatarImage src={url} alt="Avatar option" />
                    </Avatar>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Segurança - PIN */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Segurança
            </CardTitle>
            <CardDescription>
              Configure um PIN para proteger ações sensíveis como confirmação de pagamentos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">PIN de Pagamento</p>
                  <p className="text-xs text-muted-foreground">
                    {hasPin ? 'PIN configurado ✓' : 'Nenhum PIN configurado'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPinDialogOpen(true)}
              >
                {hasPin ? 'Alterar PIN' : 'Configurar PIN'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <SetupPinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        onConfirm={handlePinConfirm}
        isUpdate={hasPin}
      />
    </Layout>
  );
}
