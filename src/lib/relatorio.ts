import { ClienteCalculado } from '@/types/cliente';

// Relatório de cobrança: reconstrói o valor cheio (o que o cliente paga) a partir da parte
// gravada no Recorrência Pro e divide o líquido entre você e o sócio.
//
// Cada conta guarda só a sua parte de cada parcela:
//   Hotmart: valor_parcela = (preço − 8,9% − R$ 1) × seu %
//   Asaas:   valor_parcela = (preço − R$ 2,98) × seu %
// Aqui fazemos a conta inversa para chegar ao preço cheio da parcela.

export type Plataforma = 'Hotmart' | 'Asaas';

export type Situacao = 'Atrasado' | 'Em revisão' | 'Em dia' | 'Quitado' | 'Cancelado' | 'Pausado';

export const TAXA_HOTMART_PERCENTUAL = 0.089;
export const TAXA_HOTMART_FIXA = 1;
export const TAXA_ASAAS_FIXA = 2.98;
export const PERCENTUAL_PADRAO = 30;

export interface LinhaRelatorio {
  id: string;
  cliente: string;
  whatsapp: string | null;
  produto: string;
  plataforma: Plataforma;
  situacao: Situacao;
  parcelasPagas: number;
  totalParcelas: number;
  /** Parcelas que já venceram e não foram pagas. */
  parcelasEmAberto: number;
  diasAtraso: number;
  /** Datas de vencimento das parcelas em aberto. */
  vencimentos: Date[];
  /** Sua parte de cada parcela, como está no Recorrência Pro. */
  valorParcelaSuaParte: number;
  /** Preço cheio estimado de cada parcela (o que o cliente paga). */
  valorParcelaCheia: number;
  /** Valor cheio das parcelas em aberto (parcelasEmAberto × valorParcelaCheia). */
  valorCheio: number;
  taxas: number;
  liquido: number;
  suaParte: number;
  parteSocio: number;
  /** Valor cheio de tudo que falta pagar, vencido ou não. */
  saldoRestanteCheio: number;
  /** Todas as parcelas do contrato já venceram (não há mais nada a vencer). */
  contratoEncerrado: boolean;
  ultimoPagamento: string | null;
  dataInicio: string;
  diaVencimento: number;
  observacao: string | null;
}

export function inferirPlataforma(produto: string, nome = ''): Plataforma {
  const p = (produto || '').trim().toLowerCase();
  if (p === 'asaas' || p.includes('asaas') || /\(asaas/i.test(nome)) return 'Asaas';
  return 'Hotmart';
}

const arred2 = (x: number) => Math.round(x * 100) / 100;

/**
 * O valor gravado no RP foi arredondado em centavos, então a conta inversa quase nunca dá redondo
 * (R$ 136,33 → R$ 499,93). Preços de venda são quase sempre redondos: aproximamos para o real
 * mais próximo quando a diferença é pequena, ou para os 10 centavos (R$ 99,70).
 */
export function arredondarPreco(x: number): number {
  if (!isFinite(x) || x <= 0) return 0;
  const inteiro = Math.round(x);
  if (Math.abs(x - inteiro) <= 0.1) return inteiro;
  const dezCentavos = Math.round(x * 10) / 10;
  if (Math.abs(x - dezCentavos) <= 0.02) return arred2(dezCentavos);
  return arred2(x);
}

export function estimarParcelaCheia(valorSuaParte: number, plataforma: Plataforma, percentual: number): number {
  const p = percentual / 100;
  if (!p || !valorSuaParte) return 0;
  const liquido = valorSuaParte / p;
  const bruto = plataforma === 'Asaas'
    ? liquido + TAXA_ASAAS_FIXA
    : (liquido + TAXA_HOTMART_FIXA) / (1 - TAXA_HOTMART_PERCENTUAL);
  return arredondarPreco(bruto);
}

export function taxasDe(valorCheio: number, parcelas: number, plataforma: Plataforma): number {
  if (parcelas <= 0) return 0;
  return plataforma === 'Asaas'
    ? parcelas * TAXA_ASAAS_FIXA
    : valorCheio * TAXA_HOTMART_PERCENTUAL + parcelas * TAXA_HOTMART_FIXA;
}

function vencimentoNoMes(base: Date, mesesDepois: number, dia: number): Date {
  const ref = new Date(base.getFullYear(), base.getMonth() + mesesDepois, 1);
  const ultimoDia = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  return new Date(ref.getFullYear(), ref.getMonth(), Math.min(dia, ultimoDia));
}

export function situacaoDe(c: ClienteCalculado): Situacao {
  if (c.status_cliente === 'QUITADO') return 'Quitado';
  if (c.status_cliente === 'CANCELADO') return 'Cancelado';
  if (c.status_cliente === 'PAUSADO') return 'Pausado';
  if (c.parcelas_pendentes <= 0) return 'Quitado';
  return c.status;
}

export function montarLinha(c: ClienteCalculado, percentual: number): LinhaRelatorio {
  const plataforma = inferirPlataforma(c.produto, c.cliente_nome);
  const situacao = situacaoDe(c);
  const valorParcelaCheia = estimarParcelaCheia(c.valor_parcela, plataforma, percentual);

  // Parcelas vencidas e não pagas. Em revisão o cálculo do sistema zera parcelas_atrasadas,
  // mas para cobrança o que importa é quanto já venceu.
  let parcelasEmAberto = 0;
  if (situacao === 'Atrasado' || situacao === 'Em revisão') {
    parcelasEmAberto = Math.max(c.parcelas_atrasadas, c.parcelas_devidas - c.parcelas_pagas, 0);
    parcelasEmAberto = Math.min(parcelasEmAberto, Math.max(0, c.total_parcelas - c.parcelas_pagas));
  }

  const vencimentos: Date[] = [];
  if (c.primeira_data_vencimento) {
    for (let i = 0; i < parcelasEmAberto; i++) {
      const numero = c.parcelas_pagas + 1 + i;
      vencimentos.push(vencimentoNoMes(c.primeira_data_vencimento, numero - 1, c.dia_vencimento));
    }
  }

  let diasAtraso = 0;
  if (vencimentos.length > 0) {
    const hoje = new Date();
    const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    diasAtraso = Math.max(0, Math.floor((hojeSemHora.getTime() - vencimentos[0].getTime()) / 86400000));
  }

  const valorCheio = arred2(parcelasEmAberto * valorParcelaCheia);
  const taxas = arred2(taxasDe(valorCheio, parcelasEmAberto, plataforma));
  const liquido = arred2(valorCheio - taxas);
  const p = percentual / 100;
  const restantes = Math.max(0, c.total_parcelas - c.parcelas_pagas);

  return {
    id: c.id,
    cliente: c.cliente_nome,
    whatsapp: c.whatsapp,
    produto: c.produto,
    plataforma,
    situacao,
    parcelasPagas: c.parcelas_pagas,
    totalParcelas: c.total_parcelas,
    parcelasEmAberto,
    diasAtraso,
    vencimentos,
    valorParcelaSuaParte: c.valor_parcela,
    valorParcelaCheia,
    valorCheio,
    taxas,
    liquido,
    suaParte: arred2(liquido * p),
    parteSocio: arred2(liquido * (1 - p)),
    saldoRestanteCheio: arred2(restantes * valorParcelaCheia),
    contratoEncerrado: c.status_cliente === 'ATIVO' && restantes > 0 && c.parcelas_devidas >= c.total_parcelas,
    ultimoPagamento: c.data_ultimo_pagamento,
    dataInicio: c.data_inicio,
    diaVencimento: c.dia_vencimento,
    observacao: c.observacao_revisao,
  };
}

export function montarRelatorio(clientes: ClienteCalculado[], percentual: number): LinhaRelatorio[] {
  return clientes.map((c) => montarLinha(c, percentual));
}

export interface TotaisRelatorio {
  clientes: number;
  parcelas: number;
  valorCheio: number;
  taxas: number;
  liquido: number;
  suaParte: number;
  parteSocio: number;
}

export function totalizar(linhas: LinhaRelatorio[]): TotaisRelatorio {
  const t = linhas.reduce(
    (acc, l) => ({
      clientes: acc.clientes + 1,
      parcelas: acc.parcelas + l.parcelasEmAberto,
      valorCheio: acc.valorCheio + l.valorCheio,
      taxas: acc.taxas + l.taxas,
      liquido: acc.liquido + l.liquido,
      suaParte: acc.suaParte + l.suaParte,
      parteSocio: acc.parteSocio + l.parteSocio,
    }),
    { clientes: 0, parcelas: 0, valorCheio: 0, taxas: 0, liquido: 0, suaParte: 0, parteSocio: 0 },
  );
  return {
    ...t,
    valorCheio: arred2(t.valorCheio),
    taxas: arred2(t.taxas),
    liquido: arred2(t.liquido),
    suaParte: arred2(t.suaParte),
    parteSocio: arred2(t.parteSocio),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const formatarData = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

export function descreverVencimentos(l: LinhaRelatorio): string {
  if (l.vencimentos.length === 0) return '';
  const datas = l.vencimentos.map(formatarData);
  if (datas.length <= 3) return datas.join(', ').replace(/, ([^,]*)$/, ' e $1');
  return `${datas.length} parcelas, de ${datas[0]} a ${datas[datas.length - 1]}`;
}

/** Texto sem acentos e em minúsculas, para a busca. */
export function normalizar(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function lerPercentualSalvo(): number {
  try {
    const v = Number(localStorage.getItem('relatorioPercentual'));
    return v > 0 && v < 100 ? v : PERCENTUAL_PADRAO;
  } catch {
    return PERCENTUAL_PADRAO;
  }
}

export function salvarPercentual(v: number) {
  try {
    localStorage.setItem('relatorioPercentual', String(v));
  } catch {
    /* sem armazenamento: só vale nesta sessão */
  }
}
