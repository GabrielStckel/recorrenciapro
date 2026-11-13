import { LinhaRelatorio, descreverVencimentos } from '@/lib/relatorio';

const num = (v: number) => (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '');
const limpar = (s: string | null | undefined) => (s ?? '').replace(/[\t\n\r]+/g, ' ').trim();

/** Tabela compacta (TSV) com o que o assistente precisa saber de cada cliente. */
export function montarDadosAssistente(linhas: LinhaRelatorio[]): string {
  const cab = [
    'cliente', 'whatsapp', 'produto', 'plataforma', 'situacao', 'pagas', 'total_parcelas',
    'parcelas_vencidas_em_aberto', 'dias_atraso', 'vencimentos_em_aberto', 'contrato_encerrado',
    'parcela_cheia', 'valor_cheio_em_aberto', 'taxas', 'liquido', 'sua_parte', 'parte_socio',
    'saldo_restante_cheio', 'sua_parte_por_parcela', 'inicio', 'dia_vencimento', 'ultimo_pagamento', 'observacao',
  ];
  const linhasTsv = linhas.map((l) => [
    limpar(l.cliente), limpar(l.whatsapp), limpar(l.produto), l.plataforma, l.situacao,
    l.parcelasPagas, l.totalParcelas, l.parcelasEmAberto, l.diasAtraso, descreverVencimentos(l),
    l.contratoEncerrado ? 'sim' : 'nao', num(l.valorParcelaCheia), num(l.valorCheio), num(l.taxas),
    num(l.liquido), num(l.suaParte), num(l.parteSocio), num(l.saldoRestanteCheio),
    num(l.valorParcelaSuaParte), l.dataInicio, l.diaVencimento, l.ultimoPagamento ?? '', limpar(l.observacao),
  ].join('\t'));
  return [cab.join('\t'), ...linhasTsv].join('\n');
}
