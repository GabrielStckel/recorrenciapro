import { Trophy, Rocket, Star, Crown, Diamond, Target, ChevronDown, Sparkles, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface Premiacao {
  valor: number;
  nome: string;
  icon: React.ReactNode;
  cor: string;
  bgGradient: string;
}

const premiacoes: Premiacao[] = [
  { valor: 0, nome: 'Iniciante', icon: <Target className="w-5 h-5" />, cor: 'text-muted-foreground', bgGradient: 'from-zinc-500/20 to-zinc-600/20' },
  { valor: 10000, nome: 'Decolagem', icon: <Rocket className="w-5 h-5" />, cor: 'text-sky-400', bgGradient: 'from-sky-500/20 to-blue-600/20' },
  { valor: 50000, nome: 'Estrela', icon: <Star className="w-5 h-5" />, cor: 'text-amber-400', bgGradient: 'from-amber-500/20 to-orange-600/20' },
  { valor: 100000, nome: 'Bronze', icon: <Trophy className="w-5 h-5" />, cor: 'text-orange-500', bgGradient: 'from-orange-500/20 to-amber-700/20' },
  { valor: 250000, nome: 'Prata', icon: <Crown className="w-5 h-5" />, cor: 'text-slate-300', bgGradient: 'from-slate-400/20 to-zinc-500/20' },
  { valor: 500000, nome: 'Ouro', icon: <Crown className="w-5 h-5" />, cor: 'text-yellow-400', bgGradient: 'from-yellow-400/20 to-amber-500/20' },
  { valor: 1000000, nome: 'Diamante', icon: <Diamond className="w-5 h-5" />, cor: 'text-cyan-400', bgGradient: 'from-cyan-400/20 to-blue-500/20' },
];

interface MinhaEvolucaoProps {
  totalRecebido: number;
  hideValues?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MinhaEvolucao({ totalRecebido, hideValues = false, isOpen = false, onOpenChange }: MinhaEvolucaoProps) {

  const formatCurrency = (value: number) => {
    if (hideValues) return '••••••';
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    if (hideValues) return '••••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Encontrar nível atual e próximo
  const nivelAtual = premiacoes.reduce((acc, p) => (totalRecebido >= p.valor ? p : acc), premiacoes[0]);
  const proximoNivelIndex = premiacoes.findIndex(p => p.valor > totalRecebido);
  const proximoNivel = proximoNivelIndex !== -1 ? premiacoes[proximoNivelIndex] : null;

  // Calcular progresso para o próximo nível
  const nivelAtualIndex = premiacoes.indexOf(nivelAtual);
  const valorInicio = nivelAtual.valor;
  const valorFim = proximoNivel?.valor ?? premiacoes[premiacoes.length - 1].valor;
  const progresso = proximoNivel 
    ? ((totalRecebido - valorInicio) / (valorFim - valorInicio)) * 100
    : 100;

  const faltaParaProximo = proximoNivel ? proximoNivel.valor - totalRecebido : 0;

  return (
    <Card className="glass overflow-hidden relative">
      {/* Glow effect */}
      <div className={cn(
        "absolute inset-0 opacity-30 blur-3xl transition-all duration-500",
        `bg-gradient-to-br ${nivelAtual.bgGradient}`
      )} />
      
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <CardHeader className="py-4 relative">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left group min-h-[48px]">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2.5 rounded-xl bg-gradient-to-br transition-all duration-300 group-hover:scale-110",
                  nivelAtual.bgGradient
                )}>
                  <span className={nivelAtual.cor}>{nivelAtual.icon}</span>
                </div>
                <div className="flex flex-col justify-center">
                  <CardTitle className="text-base font-semibold">Minha Evolução</CardTitle>
                  <p className="text-xs text-muted-foreground">{nivelAtual.nome}</p>
                </div>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-300",
                isOpen && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-5 pt-0 relative">
            {/* Valor atual com destaque animado */}
            <div className="relative">
              <div className={cn(
                "absolute inset-0 rounded-2xl blur-xl opacity-40",
                `bg-gradient-to-r ${nivelAtual.bgGradient}`
              )} />
              <div className="relative text-center py-5 rounded-2xl bg-gradient-to-br from-card/80 to-card border border-border/50">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  <p className="text-3xl font-bold text-foreground">{formatCurrencyFull(totalRecebido)}</p>
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                </div>
                <p className="text-sm text-muted-foreground">Faturamento Total</p>
              </div>
            </div>

            {/* Barra de progresso customizada */}
            {proximoNivel && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={nivelAtual.cor}>{nivelAtual.icon}</span>
                    <span className="text-sm font-medium">{nivelAtual.nome}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{proximoNivel.nome}</span>
                    <span className={proximoNivel.cor}>{proximoNivel.icon}</span>
                  </div>
                </div>
                
                {/* Custom progress bar */}
                <div className="relative h-3 bg-secondary/50 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                      "bg-gradient-to-r from-primary via-primary to-emerald-400"
                    )}
                    style={{ width: `${Math.min(100, progresso)}%` }}
                  />
                  {/* Animated shimmer */}
                  <div 
                    className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
                    style={{ width: `${Math.min(100, progresso)}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite] -translate-x-full" 
                      style={{ animation: 'shimmer 2s infinite' }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(valorInicio)}</span>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                    <Zap className="w-3 h-3 text-primary" />
                    <span className="text-primary font-medium">
                      Falta {formatCurrencyFull(faltaParaProximo)}
                    </span>
                  </div>
                  <span>{formatCurrency(valorFim)}</span>
                </div>
              </div>
            )}

            {!proximoNivel && (
              <div className="text-center py-4 rounded-xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/20">
                <div className="flex items-center justify-center gap-2">
                  <Diamond className="w-5 h-5 text-cyan-400" />
                  <p className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    Nível Máximo!
                  </p>
                  <Diamond className="w-5 h-5 text-cyan-400" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">Você é lendário!</p>
              </div>
            )}

            {/* Lista de próximos níveis */}
            {proximoNivelIndex !== -1 && proximoNivelIndex < premiacoes.length - 1 && (
              <div className="space-y-2 pt-3 border-t border-border/50">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Target className="w-3 h-3" />
                  Próximas conquistas
                </p>
                <div className="grid gap-2">
                  {premiacoes.slice(proximoNivelIndex + 1, proximoNivelIndex + 3).map((p) => (
                    <div 
                      key={p.valor} 
                      className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className={cn("p-1.5 rounded-lg", `bg-gradient-to-br ${p.bgGradient}`)}>
                        <span className={p.cor}>{p.icon}</span>
                      </div>
                      <span className="flex-1 text-sm font-medium text-muted-foreground">{p.nome}</span>
                      <span className="text-xs text-muted-foreground/70">{formatCurrency(p.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </Card>
  );
}