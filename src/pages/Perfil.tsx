import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserSettings } from '@/hooks/useUserSettings';
import { SetupPinDialog } from '@/components/SetupPinDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Lock, ShieldCheck, Mail } from 'lucide-react';

export default function Perfil() {
  const { user } = useAuth();
  const { hasPin, createOrUpdatePin } = useUserSettings();
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
              <User className="w-4 h-4" />
              Informações da Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">E-mail</p>
                <p className="text-sm font-medium">{user?.email}</p>
              </div>
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
