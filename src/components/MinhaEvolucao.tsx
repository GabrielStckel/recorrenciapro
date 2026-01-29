import { useState } from 'react';
import { Trophy, Rocket, Star, Crown, Diamond, Target, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface Premiacao {
  valor: number;
  nome: string;
  icon: React.ReactNode;
  cor: string;
}

const premiacoes: Premiacao[] = [
  { valor: 0, nome: 'Iniciante', icon: <Target className="w-5 h-5" />, cor: 'text-muted-foreground' },
  { valor: 10000, nome: 'Decolagem', icon: <Rocket className="w-5 h-5" />, cor: 'text-blue-500' },
  { valor: 50000, nome: 'Estrela', icon: <Star className="w-5 h-5" />, cor: 'text-yellow-500' },
  { valor: 100000, nome: 'Troféu Bronze', icon: <Trophy className="w-5 h-5" />, cor: 'text-amber-600' },
  { valor: 250000, nome: 'Coroa de Prata', icon: <Crown className="w-5 h-5" />, cor: 'text-slate-400' },
  { valor: 500000, nome: 'Elite Ouro', icon: <Crown className="w-5 h-5" />, cor: 'text-yellow-400' },
  { valor: 1000000, nome: 'Diamante', icon: <Diamond className="w-5 h-5" />, cor: 'text-cyan-400' },
];

interface MinhaEvolucaoProps {
  totalRecebido: number;
  hideValues?: boolean;
}

export function MinhaEvolucao({ totalRecebido, hideValues = false }: MinhaEvolucaoProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatCurrency = (value: number) => {
    if (hideValues) return '••••••';
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)} mil`;
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
    <Card className="bg-gradient-to-br from-card to-card/80 border-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left group">
              <div className="flex items-center gap-2">
                <span className={nivelAtual.cor}>{nivelAtual.icon}</span>
                <CardTitle className="text-lg">Minha Evolução</CardTitle>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          <p className="text-xs text-muted-foreground">Atualizado em tempo real</p>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Valor atual com destaque */}
            <div className="text-center py-3 bg-primary/10 rounded-lg">
              <p className="text-2xl font-bold text-primary">{formatCurrencyFull(totalRecebido)}</p>
              <p className="text-sm text-muted-foreground">Faturamento Total</p>
            </div>

            {/* Nível atual */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <span className={`${nivelAtual.cor}`}>{nivelAtual.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{nivelAtual.nome}</p>
                <p className="text-xs text-muted-foreground">Nível atual</p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {formatCurrency(nivelAtual.valor)}+
              </span>
            </div>

            {/* Barra de progresso */}
            {proximoNivel && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(valorInicio)}</span>
                  <span>{formatCurrency(valorFim)}</span>
                </div>
                <Progress value={progresso} className="h-3" />
                <p className="text-xs text-center text-muted-foreground">
                  Falta <span className="font-medium text-primary">{formatCurrencyFull(faltaParaProximo)}</span> para{' '}
                  <span className={`font-medium ${proximoNivel.cor}`}>{proximoNivel.nome}</span>
                </p>
              </div>
            )}

            {!proximoNivel && (
              <div className="text-center py-2">
                <p className="text-sm font-medium text-primary">🎉 Nível máximo alcançado!</p>
              </div>
            )}

            {/* Lista de premiações */}
            <div className="space-y-1 pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Próximas conquistas</p>
              {premiacoes.slice(nivelAtualIndex + 1, nivelAtualIndex + 4).map((p) => (
                <div key={p.valor} className="flex items-center gap-2 text-xs text-muted-foreground opacity-70">
                  <span className={p.cor}>{p.icon}</span>
                  <span className="flex-1">{p.nome}</span>
                  <span>{formatCurrency(p.valor)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
