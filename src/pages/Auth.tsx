import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Separator } from '@/components/ui/separator';

const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

function SocialLoginButtons({ loading, setLoading }: { loading: boolean; setLoading: (v: boolean) => void }) {
  const { toast } = useToast();

  const handleOAuth = async (provider: 'google' | 'apple') => {
    try {
      setLoading(true);
      const { lovable } = await import('@/integrations/lovable/index');
      const { error } = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (error) {
        toast({ title: 'Erro', description: `Falha ao entrar com ${provider === 'google' ? 'Google' : 'Apple'}.`, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro inesperado', description: 'Login social indisponível no momento.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button variant="outline" className="w-full gap-2" onClick={() => handleOAuth('google')} disabled={loading}>
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Entrar com Google
      </Button>
      <Button variant="outline" className="w-full gap-2" onClick={() => handleOAuth('apple')} disabled={loading}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
        Entrar com Apple
      </Button>
    </div>
  );
}

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (type: 'login' | 'signup') => {
    try {
      const result = authSchema.safeParse({ email, password });
      if (!result.success) {
        toast({ title: 'Erro de validação', description: result.error.errors[0].message, variant: 'destructive' });
        return;
      }
      setLoading(true);
      if (type === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          let message = error.message;
          if (error.message.includes('Invalid login credentials')) message = 'Email ou senha incorretos';
          else if (error.message.includes('Email not confirmed')) message = 'Verifique seu email antes de fazer login.';
          toast({ title: 'Erro', description: message, variant: 'destructive' });
        } else {
          navigate('/');
        }
      } else {
        if (password !== confirmPassword) {
          toast({ title: 'Erro de validação', description: 'As senhas não coincidem', variant: 'destructive' });
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password);
        if (error) {
          let message = error.message;
          if (error.message.includes('User already registered')) message = 'Este email já está cadastrado';
          toast({ title: 'Erro', description: message, variant: 'destructive' });
        } else {
          toast({ title: 'Verifique seu email ✉️', description: 'Enviamos um link de confirmação para ' + email, duration: 10000 });
          setEmail('');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch {
      toast({ title: 'Erro inesperado', description: 'Por favor, tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: 'Informe seu email', description: 'Digite seu email acima para receber o link de recuperação.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Email enviado ✉️', description: `Enviamos um link de recuperação para ${email}. Verifique sua caixa de entrada.`, duration: 10000 });
        setForgotMode(false);
      }
    } catch {
      toast({ title: 'Erro inesperado', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl mb-4 bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-2xl font-bold text-primary-foreground">R</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">Recorrência Pro</h1>
          <p className="text-muted-foreground mt-2">Sistema de controle de recorrências</p>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle>{forgotMode ? 'Recuperar Senha' : 'Acesso ao Sistema'}</CardTitle>
            <CardDescription>
              {forgotMode ? 'Informe seu email para receber o link de recuperação' : 'Entre ou crie sua conta para continuar'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {forgotMode ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-forgot">Email</Label>
                  <Input
                    id="email-forgot"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
                  />
                </div>
                <Button className="w-full" onClick={handleForgotPassword} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Enviar Link de Recuperação
                </Button>
                <Button variant="ghost" className="w-full gap-2" onClick={() => setForgotMode(false)}>
                  <ArrowLeft className="w-4 h-4" /> Voltar ao login
                </Button>
              </div>
            ) : (
              <>
                <SocialLoginButtons loading={loading} setLoading={setLoading} />
                
                <div className="relative my-6">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                    ou continue com email
                  </span>
                </div>

                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login">Entrar</TabsTrigger>
                    <TabsTrigger value="signup">Criar Conta</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email-login">Email</Label>
                      <Input id="email-login" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password-login">Senha</Label>
                      <div className="relative">
                        <Input id="password-login" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} onKeyDown={(e) => e.key === 'Enter' && handleSubmit('login')} className="pr-10" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => handleSubmit('login')} disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Entrar
                    </Button>
                    <button
                      type="button"
                      onClick={() => setForgotMode(true)}
                      className="w-full text-sm text-muted-foreground hover:text-primary transition-colors text-center"
                    >
                      Esqueci minha senha
                    </button>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email-signup">Email</Label>
                      <Input id="email-signup" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password-signup">Senha</Label>
                      <div className="relative">
                        <Input id="password-signup" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} onKeyDown={(e) => e.key === 'Enter' && handleSubmit('signup')} className="pr-10" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => handleSubmit('signup')} disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Criar Conta
                    </Button>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
