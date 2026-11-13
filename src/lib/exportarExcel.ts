import ExcelJS from 'exceljs';
import {
  LinhaRelatorio,
  TAXA_ASAAS_FIXA,
  TAXA_HOTMART_FIXA,
  TAXA_HOTMART_PERCENTUAL,
  descreverVencimentos,
  formatarData,
} from '@/lib/relatorio';

const HEADER_BG = 'FFF3F3F3';
const BRL = '"R$ "#,##0.00';
const BORDA = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } };

function baixar(buffer: ArrayBuffer, nomeArquivo: string) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

const hojeArquivo = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function estilizarCabecalho(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.border = { bottom: BORDA };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
}

/**
 * Planilha do relatório, com fórmulas: se mudar parcelas, valor da parcela ou plataforma,
 * taxas, líquido e a divisão recalculam sozinhos.
 */
export async function exportarRelatorioExcel(linhas: LinhaRelatorio[], percentual: number, descricao: string) {
  const p = percentual / 100;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Recorrência Pro';
  wb.created = new Date();

  const ws = wb.addWorksheet('Relatório', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Cliente', key: 'cliente', width: 44 },
    { header: 'Valor cheio', key: 'cheio', width: 15 },
    { header: `Sua parte (${percentual}%)`, key: 'sua', width: 16 },
    { header: `Sócio (${100 - percentual}%)`, key: 'socio', width: 16 },
    { header: 'Parcelas em aberto', key: 'parcelas', width: 12 },
    { header: 'Valor da parcela', key: 'parcela', width: 15 },
    { header: 'Plataforma', key: 'plataforma', width: 12 },
    { header: 'Taxas', key: 'taxas', width: 13 },
    { header: 'Líquido', key: 'liquido', width: 15 },
    { header: 'Produto', key: 'produto', width: 26 },
    { header: 'Situação', key: 'situacao', width: 13 },
    { header: 'Vencimentos em aberto', key: 'vencimentos', width: 30 },
    { header: 'Pagas', key: 'pagas', width: 10 },
    { header: 'Saldo restante (cheio)', key: 'saldo', width: 17 },
    { header: 'WhatsApp', key: 'whatsapp', width: 18 },
    { header: 'Observação', key: 'obs', width: 40 },
  ];
  estilizarCabecalho(ws.getRow(1));

  const primeira = 2;
  linhas.forEach((l, i) => {
    const r = primeira + i;
    const row = ws.addRow({
      cliente: l.cliente,
      parcelas: l.parcelasEmAberto,
      parcela: l.valorParcelaCheia,
      plataforma: l.plataforma,
      produto: l.produto,
      situacao: l.situacao,
      vencimentos: l.contratoEncerrado && l.vencimentos.length
        ? `${descreverVencimentos(l)} (todas as parcelas já venceram)`
        : descreverVencimentos(l),
      pagas: `${l.parcelasPagas}/${l.totalParcelas}`,
      saldo: l.saldoRestanteCheio,
      whatsapp: l.whatsapp ?? '',
      obs: l.observacao ?? '',
    });
    row.getCell('cheio').value = { formula: `E${r}*F${r}`, result: l.valorCheio };
    row.getCell('taxas').value = {
      formula: `IF(G${r}="Asaas",E${r}*${TAXA_ASAAS_FIXA},B${r}*${TAXA_HOTMART_PERCENTUAL}+E${r}*${TAXA_HOTMART_FIXA})`,
      result: l.taxas,
    };
    row.getCell('liquido').value = { formula: `B${r}-H${r}`, result: l.liquido };
    row.getCell('sua').value = { formula: `I${r}*${p}`, result: l.suaParte };
    row.getCell('socio').value = { formula: `I${r}*${1 - p}`, result: l.parteSocio };
    row.getCell('obs').alignment = { wrapText: true, vertical: 'top' };
  });

  const ultima = primeira + linhas.length - 1;
  const somar = (col: string) => (linhas.length ? `SUM(${col}${primeira}:${col}${ultima})` : '0');
  const soma = (f: (l: LinhaRelatorio) => number) => linhas.reduce((s, l) => s + f(l), 0);
  const total = ws.addRow({ cliente: 'Total' });
  total.getCell('cheio').value = { formula: somar('B'), result: soma((l) => l.valorCheio) };
  total.getCell('sua').value = { formula: somar('C'), result: soma((l) => l.suaParte) };
  total.getCell('socio').value = { formula: somar('D'), result: soma((l) => l.parteSocio) };
  total.getCell('parcelas').value = { formula: somar('E'), result: soma((l) => l.parcelasEmAberto) };
  total.getCell('taxas').value = { formula: somar('H'), result: soma((l) => l.taxas) };
  total.getCell('liquido').value = { formula: somar('I'), result: soma((l) => l.liquido) };
  total.getCell('saldo').value = { formula: somar('N'), result: soma((l) => l.saldoRestanteCheio) };
  total.eachCell((cell) => {
    cell.font = { bold: true };
    cell.border = { top: BORDA };
  });

  ['B', 'C', 'D', 'F', 'H', 'I', 'N'].forEach((col) => {
    ws.getColumn(col).numFmt = BRL;
  });

  ws.addRow([]);
  const nota = ws.addRow([
    `${descricao}. Gerado em ${formatarData(new Date())}. Valor cheio estimado a partir da sua parte no Recorrência Pro. ` +
      `Taxas: Hotmart 8,9% + R$ 1 por parcela; Asaas R$ 2,98 por cobrança. Divisão ${percentual}/${100 - percentual} sobre o líquido.`,
  ]);
  nota.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

  const buffer = await wb.xlsx.writeBuffer();
  baixar(buffer as ArrayBuffer, `relatorio-recorrencia-pro-${hojeArquivo()}.xlsx`);
}

export type FormatoColuna = 'texto' | 'moeda' | 'numero' | 'data';

export interface TabelaGenerica {
  titulo: string;
  colunas: string[];
  linhas: (string | number | null)[][];
  formatos?: FormatoColuna[];
  /** Colunas (pelo índice) que ganham soma na última linha. */
  totais?: number[];
}

function letraColuna(n: number): string {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** Converte "dd/mm/aaaa" ou "aaaa-mm-dd" em data; o resto fica como veio. */
function paraData(v: string | number | null): Date | string | number | null {
  if (typeof v !== 'string') return v;
  let m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return v;
}

/** Planilha de uma tabela qualquer (as que o assistente devolve). */
export async function exportarTabelaExcel(tabela: TabelaGenerica) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Recorrência Pro';
  wb.created = new Date();
  const nomeAba = (tabela.titulo || 'Tabela').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Tabela';
  const ws = wb.addWorksheet(nomeAba, { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.addRow(tabela.colunas);
  estilizarCabecalho(ws.getRow(1));

  const formatos = tabela.formatos ?? [];
  tabela.linhas.forEach((linha) => {
    ws.addRow(linha.map((v, i) => (formatos[i] === 'data' ? paraData(v) : v)));
  });

  if (tabela.totais?.length && tabela.linhas.length) {
    const ultima = tabela.linhas.length + 1;
    const valores: (string | ExcelJS.CellFormulaValue | null)[] = tabela.colunas.map(() => null);
    valores[0] = 'Total';
    tabela.totais.forEach((i) => {
      if (i <= 0 || i >= tabela.colunas.length) return;
      const col = letraColuna(i + 1);
      const result = tabela.linhas.reduce((s, l) => s + (typeof l[i] === 'number' ? (l[i] as number) : 0), 0);
      valores[i] = { formula: `SUM(${col}2:${col}${ultima})`, result };
    });
    const total = ws.addRow(valores);
    total.eachCell((cell) => {
      cell.font = { bold: true };
      cell.border = { top: BORDA };
    });
  }

  tabela.colunas.forEach((nome, i) => {
    const col = ws.getColumn(i + 1);
    if (formatos[i] === 'moeda') col.numFmt = BRL;
    if (formatos[i] === 'data') col.numFmt = 'dd/mm/yyyy';
    const maior = Math.max(
      nome.length,
      ...tabela.linhas.map((l) => String(l[i] ?? '').length),
    );
    col.width = Math.min(48, Math.max(10, maior + 3));
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: tabela.colunas.length } };

  const nomeArquivo = (tabela.titulo || 'tabela')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tabela';
  const buffer = await wb.xlsx.writeBuffer();
  baixar(buffer as ArrayBuffer, `${nomeArquivo}-${hojeArquivo()}.xlsx`);
}
