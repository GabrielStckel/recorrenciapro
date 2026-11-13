import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useClientes } from '@/hooks/useClientes';
import { useToast } from '@/hooks/use-toast';
import { lerPercentualSalvo, montarRelatorio } from '@/lib/relatorio';
import { montarDadosAssistente } from '@/lib/assistenteDados';
import { TabelaGenerica, exportarTabelaExcel } from '@/lib/exportarExcel';

interface MensagemChat {
  role: 'user' | 'assistant';
  content: string;
  tabela?: TabelaGenerica | null;
  erro?: boolean;
}

const CHAVE_CONVERSA = 'assistenteClaudeConversa';

const SUGESTOES = [
  'Quem está em atraso e quanto cada um deve?',
  'Gera a planilha dos atrasados com a minha parte e a do sócio',
  'Quanto vou receber de parcelas este mês?',
  'Quais clientes terminam o contrato nos próximos 2 meses?',
];

function lerConversa(): MensagemChat[] {
  try {
    const salvo = sessionStorage.getItem(CHAVE_CONVERSA);
    return salvo ? (JSON.parse(salvo) as MensagemChat[]) : [];
  } catch {
    return [];
  }
}

async function lerErro(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const corpo = await ctx.json();
      if (corpo?.erro) return corpo.erro;
    } catch {
      /* corpo não era JSON */
    }
  }
  return 'Não consegui falar com o assistente agora. Tente de novo.';
}

function TabelaResposta({ tabela }: { tabela: TabelaGenerica }) {
  const { toast } = useToast();
  const [baixando, setBaixando] = useState(false);
  const formatos = tabela.formatos ?? [];
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const mostrar = (v: string | number | null, i: number) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return formatos[i] === 'moeda' ? brl.format(v) : v.toLocaleString('pt-BR');
    return v;
  };

  const baixar = async () => {
    setBaixando(true);
    try {
      await exportarTabelaExcel(tabela);
    } catch (e) {
      toast({ title: 'Erro ao gerar a planilha', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-background/60">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60">
        <span className="text-xs font-semibold truncate">{tabela.titulo}</span>
        <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={baixar} disabled={baixando}>
          {baixando ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
          Baixar planilha
        </Button>
      </div>
      <div className="max-h-72 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {tabela.colunas.map((c, i) => (
                <TableHead key={i} className={cn('text-xs h-8 whitespace-nowrap', ['moeda', 'numero'].includes(formatos[i]) && 'text-right')}>{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tabela.linhas.map((linha, r) => (
              <TableRow key={r}>
                {linha.map((v, i) => (
                  <TableCell key={i} className={cn('text-xs py-1.5 whitespace-nowrap', typeof v === 'number' && 'text-right tabular-nums')}>
                    {mostrar(v, i)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function AssistenteClaude() {
  const location = useLocation();
  const { clientes } = useClientes();
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<MensagemChat[]>(lerConversa);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE_CONVERSA, JSON.stringify(mensagens.slice(-30)));
    } catch {
      /* sem armazenamento: a conversa vale só enquanto a tela estiver aberta */
    }
  }, [mensagens]);

  useEffect(() => {
    if (aberto) fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, aberto, enviando]);

  const dados = useMemo(() => {
    if (!aberto) return '';
    return montarDadosAssistente(montarRelatorio(clientes, lerPercentualSalvo()));
  }, [clientes, aberto]);

  if (location.pathname === '/auth') return null;

  const enviar = async (pergunta: string) => {
    const conteudo = pergunta.trim();
    if (!conteudo || enviando) return;
    const nova: MensagemChat = { role: 'user', content: conteudo };
    const historico = [...mensagens, nova];
    setMensagens(historico);
    setTexto('');
    setEnviando(true);

    try {
      const { data, error } = await supabase.functions.invoke('assistente-claude', {
        body: {
          percentual: lerPercentualSalvo(),
          dados,
          mensagens: historico
            .filter((m) => !m.erro)
            .map((m) => ({
              role: m.role,
              content: m.tabela ? `${m.content}\n[Tabela enviada: ${m.tabela.titulo}, ${m.tabela.linhas.length} linhas]` : m.content,
            })),
        },
      });
      if (error) throw error;
      setMensagens((atual) => [
        ...atual,
        { role: 'assistant', content: data?.resposta || '(sem resposta)', tabela: data?.tabela ?? null },
      ]);
    } catch (e) {
      const msg = await lerErro(e);
      setMensagens((atual) => [...atual, { role: 'assistant', content: msg, erro: true }]);
    } finally {
      setEnviando(false);
    }
  };

  const limparConversa = () => {
    setMensagens([]);
    toast({ title: 'Conversa apagada' });
  };

  return (
    <>
      <Button
        onClick={() => setAberto(true)}
        className="fixed bottom-5 right-5 z-40 h-12 rounded-full shadow-lg gap-2 px-4"
        title="Perguntar ao Claude"
      >
        <Sparkles className="w-5 h-5" />
        <span className="hidden sm:inline">Perguntar ao Claude</span>
      </Button>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 text-left">
            <div className="flex items-center justify-between gap-2 pr-6">
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> Perguntar ao Claude
              </SheetTitle>
              {mensagens.length > 0 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={limparConversa}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar
                </Button>
              )}
            </div>
            <SheetDescription className="text-xs">
              Responde com base nos seus clientes do Recorrência Pro e gera planilhas. Só lê os dados, não altera nada.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {mensagens.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Experimente:</p>
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="block w-full text-left text-sm rounded-lg border border-border/60 px-3 py-2 hover:bg-primary/10 hover:border-primary/40 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {mensagens.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5 text-sm max-w-[92%]',
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/60',
                    m.erro && 'bg-destructive/15 text-destructive',
                    m.tabela && 'w-full max-w-full',
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  {m.tabela && m.tabela.colunas?.length > 0 && <TabelaResposta tabela={m.tabela} />}
                </div>
              </div>
            ))}

            {enviando && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Pensando...
              </div>
            )}
            <div ref={fimRef} />
          </div>

          <form
            className="border-t border-border/60 p-3 flex gap-2 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
          >
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  enviar(texto);
                }
              }}
              placeholder="Ex.: quanto a Reysla deve?"
              className="min-h-[44px] max-h-40 resize-none"
              rows={1}
              disabled={enviando}
            />
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={enviando || !texto.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
