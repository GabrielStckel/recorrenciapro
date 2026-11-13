import { useMemo, useState } from 'react';
import { useClientes } from '@/hooks/useClientes';
import { useHideValues } from '@/hooks/useHideValues';
import { Layout } from '@/components/Layout';
import { KPICard } from '@/components/KPICard';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Download, Eye, EyeOff, Loader2, Search, Users, Wallet, Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  LinhaRelatorio,
  Situacao,
  descreverVencimentos,
  lerPercentualSalvo,
  montarRelatorio,
  normalizar,
  salvarPercentual,
  totalizar,
} from '@/lib/relatorio';
import { exportarRelatorioExcel } from '@/lib/exportarExcel';

type FiltroSituacao = 'atraso' | 'ativos' | 'em_dia' | 'quitados' | 'cancelados' | 'todos';

const filtrosSituacao: { value: FiltroSituacao; label: string }[] = [
  { value: 'atraso', label: 'Em atraso (inclui em revisão)' },
  { value: 'ativos', label: 'Todos os ativos' },
  { value: 'em_dia', label: 'Em dia' },
  { value: 'quitados', label: 'Quitados' },
  { value: 'cancelados', label: 'Cancelados' },
  { value: 'todos', label: 'Todos' },
];

const corSituacao: Record<Situacao, string> = {
  'Atrasado': 'bg-destructive/20 text-destructive',
  'Em revisão': 'bg-warning/20 text-warning',
  'Em dia': 'bg-success/20 text-success',
  'Quitado': 'bg-info/20 text-info',
  'Cancelado': 'bg-muted text-muted-foreground',
  'Pausado': 'bg-warning/10 text-warning',
};

function passaFiltro(l: LinhaRelatorio, f: FiltroSituacao): boolean {
  switch (f) {
    case 'atraso': return l.parcelasEmAberto > 0;
    case 'ativos': return ['Atrasado', 'Em revisão', 'Em dia'].includes(l.situacao);
    case 'em_dia': return l.situacao === 'Em dia';
    case 'quitados': return l.situacao === 'Quitado';
    case 'cancelados': return l.situacao === 'Cancelado';
    default: return true;
  }
}

export default function Relatorios() {
  const { clientes, isLoading } = useClientes();
  const { hideValues, toggleHideValues } = useHideValues();
  const { toast } = useToast();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroSituacao>('atraso');
  const [plataforma, setPlataforma] = useState<'todas' | 'Hotmart' | 'Asaas'>('todas');
  const [produto, setProduto] = useState('todos');
  const [percentual, setPercentual] = useState<number>(lerPercentualSalvo);
  const [exportando, setExportando] = useState(false);

  const produtos = useMemo(
    () => Array.from(new Set(clientes.map((c) => c.produto))).sort((a, b) => a.localeCompare(b)),
    [clientes],
  );

  const linhas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return montarRelatorio(clientes, percentual)
      .filter((l) => passaFiltro(l, filtro))
      .filter((l) => plataforma === 'todas' || l.plataforma === plataforma)
      .filter((l) => produto === 'todos' || l.produto === produto)
      .filter((l) => !termo || normalizar(`${l.cliente} ${l.produto} ${l.whatsapp ?? ''}`).includes(termo))
      .sort((a, b) => b.valorCheio - a.valorCheio || b.saldoRestanteCheio - a.saldoRestanteCheio || a.cliente.localeCompare(b.cliente));
  }, [clientes, percentual, busca, filtro, plataforma, produto]);

  const totais = useMemo(() => totalizar(linhas), [linhas]);

  const brl = (v: number) =>
    hideValues ? '••••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const alterarPercentual = (v: string) => {
    const n = Number(v.replace(',', '.'));
    if (!isFinite(n)) return;
    const limitado = Math.min(99, Math.max(1, Math.round(n)));
    setPercentual(limitado);
    salvarPercentual(limitado);
  };

  const exportar = async () => {
    setExportando(true);
    try {
      const partes = [filtrosSituacao.find((f) => f.value === filtro)?.label ?? ''];
      if (plataforma !== 'todas') partes.push(plataforma);
      if (produto !== 'todos') partes.push(produto);
      if (busca.trim()) partes.push(`busca "${busca.trim()}"`);
      await exportarRelatorioExcel(linhas, percentual, `Filtro: ${partes.join(', ')}`);
    } catch (e) {
      toast({ title: 'Erro ao gerar a planilha', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setExportando(false);
    }
  };

  if (isLoading) {
    return <Layout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>;
  }

  const mostraAtraso = filtro === 'atraso' || linhas.some((l) => l.parcelasEmAberto > 0);

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Relatórios</h1>
            <p className="text-sm text-muted-foreground">
              Quanto cada cliente deve em valor cheio, as taxas e a divisão entre você e o sócio.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleHideValues}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            >
              {hideValues ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
            <Button onClick={exportar} disabled={exportando || linhas.length === 0}>
              {exportando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Baixar planilha
            </Button>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <KPICard
            title={mostraAtraso ? 'Valor cheio em atraso' : 'Valor cheio em aberto'}
            value={brl(totais.valorCheio)}
            icon={AlertTriangle}
            variant={totais.valorCheio > 0 ? 'destructive' : 'default'}
            subtitle={`${totais.parcelas} ${totais.parcelas === 1 ? 'parcela' : 'parcelas'} · taxas ${brl(totais.taxas)}`}
          />
          <KPICard title={`Sua parte (${percentual}%)`} value={brl(totais.suaParte)} icon={Wallet} variant="success" subtitle={`Líquido ${brl(totais.liquido)}`} />
          <KPICard title={`Parte do sócio (${100 - percentual}%)`} value={brl(totais.parteSocio)} icon={Handshake} />
          <KPICard title="Clientes no filtro" value={String(totais.clientes)} icon={Users} />
        </div>

        <Card className="glass">
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="busca-relatorio">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="busca-relatorio"
                    placeholder="Nome, produto ou WhatsApp"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Situação</Label>
                <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroSituacao)}>
                  <SelectTrigger className="md:w-[230px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {filtrosSituacao.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Plataforma</Label>
                <Select value={plataforma} onValueChange={(v) => setPlataforma(v as typeof plataforma)}>
                  <SelectTrigger className="md:w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="Hotmart">Hotmart</SelectItem>
                    <SelectItem value="Asaas">Asaas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Produto</Label>
                <Select value={produto} onValueChange={setProduto}>
                  <SelectTrigger className="md:w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {produtos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="percentual">Sua parte (%)</Label>
                <Input
                  id="percentual"
                  type="number"
                  min={1}
                  max={99}
                  value={percentual}
                  onChange={(e) => alterarPercentual(e.target.value)}
                  className="md:w-[90px]"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border/50 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Em aberto</TableHead>
                    <TableHead className="text-right">Valor cheio</TableHead>
                    <TableHead className="text-right">Sua parte</TableHead>
                    <TableHead className="text-right">Sócio</TableHead>
                    <TableHead className="text-right">Parcela cheia</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Vencimentos em aberto</TableHead>
                    <TableHead className="text-right">Saldo restante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                        Nenhum cliente neste filtro.
                      </TableCell>
                    </TableRow>
                  )}
                  {linhas.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="min-w-[220px]">
                        <div className="font-medium">{l.cliente}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', corSituacao[l.situacao])}>
                            {l.situacao}{l.diasAtraso > 0 ? ` · ${l.diasAtraso}d` : ''}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{l.produto} · {l.parcelasPagas}/{l.totalParcelas} pagas</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.parcelasEmAberto || '-'}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{l.valorCheio ? brl(l.valorCheio) : '-'}</TableCell>
                      <TableCell className="text-right tabular-nums text-success">{l.suaParte ? brl(l.suaParte) : '-'}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.parteSocio ? brl(l.parteSocio) : '-'}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(l.valorParcelaCheia)}</TableCell>
                      <TableCell>{l.plataforma}</TableCell>
                      <TableCell className="text-sm min-w-[180px]">
                        {descreverVencimentos(l) || '-'}
                        {l.contratoEncerrado && <div className="text-xs text-destructive">Todas as parcelas já venceram</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.saldoRestanteCheio ? brl(l.saldoRestanteCheio) : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {linhas.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Total ({totais.clientes})</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{totais.parcelas}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{brl(totais.valorCheio)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-success">{brl(totais.suaParte)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{brl(totais.parteSocio)}</TableCell>
                      <TableCell colSpan={3} />
                      <TableCell className="text-right tabular-nums font-semibold">
                        {brl(linhas.reduce((s, l) => s + l.saldoRestanteCheio, 0))}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              O valor cheio é estimado a partir da sua parte gravada em cada cliente (Hotmart: 8,9% + R$ 1 por parcela;
              Asaas: R$ 2,98 por cobrança). Produto "Asaas" ou nome com "(Asaas" conta como Asaas; o resto, como Hotmart.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
