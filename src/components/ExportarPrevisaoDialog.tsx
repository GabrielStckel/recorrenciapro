import { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClienteCalculado } from '@/types/cliente';
import { Download, FileSpreadsheet, FileText, FileType, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

type FormatoExport = 'excel' | 'pdf' | 'csv';
type ModoExport = 'mes' | 'periodo';

interface ExportarPrevisaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: ClienteCalculado[];
}

interface DiaParcela {
  dia: number;
  data: string;
  cliente: string;
  produto: string;
  numeroParcela: number;
  totalParcelas: number;
  valor: number;
  status: 'Pago' | 'A receber' | 'Atrasado' | 'Em revisão';
}

const STATUS_COLORS = {
  'Pago': '#16a34a',
  'A receber': '#94a3b8',
  'Atrasado': '#dc2626',
  'Em revisão': '#eab308',
};

export function ExportarPrevisaoDialog({ open, onOpenChange, clientes }: ExportarPrevisaoDialogProps) {
  const hoje = new Date();
  const [formato, setFormato] = useState<FormatoExport>('pdf');
  const [modo, setModo] = useState<ModoExport>('mes');
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth());
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());
  const [mesesPeriodo, setMesesPeriodo] = useState(6);
  const [statusSelecionados, setStatusSelecionados] = useState<Set<string>>(
    new Set(['Pago', 'A receber', 'Atrasado', 'Em revisão'])
  );
  const [incluirGrafico, setIncluirGrafico] = useState(true);
  const [incluirResumo, setIncluirResumo] = useState(true);
  const [incluirDetalhes, setIncluirDetalhes] = useState(true);
  const [exportando, setExportando] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // Generate parcels data for selected period
  const parcelasData = useMemo((): DiaParcela[] => {
    const result: DiaParcela[] = [];
    const hojeData = new Date();

    const getDueDate = (year: number, month: number, diaVenc: number) => {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(diaVenc, lastDay));
    };

    clientes.forEach((cliente) => {
      if (cliente.status_cliente !== 'ATIVO') return;

      const [yi, mi] = cliente.data_inicio.split('-').map(Number);
      const inicio = new Date(yi, mi - 1, 1);

      for (let i = 0; i < cliente.total_parcelas; i++) {
        const due = getDueDate(inicio.getFullYear(), inicio.getMonth() + i, cliente.dia_vencimento);
        const numeroParcela = i + 1;

        // Filter by mode
        if (modo === 'mes') {
          if (due.getMonth() !== mesSelecionado || due.getFullYear() !== anoSelecionado) continue;
        } else {
          const limite = new Date(hojeData.getFullYear(), hojeData.getMonth() + mesesPeriodo, hojeData.getDate());
          const inicioPeriodo = new Date(hojeData.getFullYear(), hojeData.getMonth(), 1);
          if (due < inicioPeriodo || due > limite) continue;
        }

        // Determine status
        let status: DiaParcela['status'];
        if (numeroParcela <= cliente.parcelas_pagas) {
          status = 'Pago';
        } else if (due > hojeData) {
          status = 'A receber';
        } else if (cliente.em_revisao) {
          status = 'Em revisão';
        } else {
          status = 'Atrasado';
        }

        if (!statusSelecionados.has(status)) continue;

        result.push({
          dia: due.getDate(),
          data: `${String(due.getDate()).padStart(2, '0')}/${String(due.getMonth() + 1).padStart(2, '0')}/${due.getFullYear()}`,
          cliente: cliente.cliente_nome,
          produto: cliente.produto,
          numeroParcela,
          totalParcelas: cliente.total_parcelas,
          valor: cliente.valor_parcela,
          status,
        });
      }
    });

    return result.sort((a, b) => {
      const [da, ma, ya] = a.data.split('/').map(Number);
      const [db, mb, yb] = b.data.split('/').map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });
  }, [clientes, modo, mesSelecionado, anoSelecionado, mesesPeriodo, statusSelecionados]);

  // Aggregated chart data
  const chartData = useMemo(() => {
    if (modo === 'mes') {
      // Group by day
      const map = new Map<number, { dia: string; valor: number }>();
      parcelasData.forEach(p => {
        const cur = map.get(p.dia) || { dia: String(p.dia).padStart(2, '0'), valor: 0 };
        cur.valor += p.valor;
        map.set(p.dia, cur);
      });
      return Array.from(map.values()).sort((a, b) => Number(a.dia) - Number(b.dia));
    } else {
      // Group by month
      const map = new Map<string, { dia: string; valor: number; ord: number }>();
      parcelasData.forEach(p => {
        const [_, m, y] = p.data.split('/').map(Number);
        const key = `${y}-${m}`;
        const nome = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const cur = map.get(key) || { dia: nome, valor: 0, ord: y * 12 + m };
        cur.valor += p.valor;
        map.set(key, cur);
      });
      return Array.from(map.values()).sort((a, b) => a.ord - b.ord);
    }
  }, [parcelasData, modo]);

  const totais = useMemo(() => {
    const total = parcelasData.reduce((s, p) => s + p.valor, 0);
    const pago = parcelasData.filter(p => p.status === 'Pago').reduce((s, p) => s + p.valor, 0);
    const aReceber = parcelasData.filter(p => p.status === 'A receber').reduce((s, p) => s + p.valor, 0);
    const atrasado = parcelasData.filter(p => p.status === 'Atrasado').reduce((s, p) => s + p.valor, 0);
    const emRevisao = parcelasData.filter(p => p.status === 'Em revisão').reduce((s, p) => s + p.valor, 0);
    return { total, pago, aReceber, atrasado, emRevisao, qtd: parcelasData.length };
  }, [parcelasData]);

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const periodoLabel = useMemo(() => {
    if (modo === 'mes') {
      return new Date(anoSelecionado, mesSelecionado, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    return `Próximos ${mesesPeriodo} meses`;
  }, [modo, mesSelecionado, anoSelecionado, mesesPeriodo]);

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - 1 + i);

  const toggleStatus = (s: string) => {
    const novo = new Set(statusSelecionados);
    if (novo.has(s)) novo.delete(s);
    else novo.add(s);
    setStatusSelecionados(novo);
  };

  const captureChart = async (): Promise<string | null> => {
    if (!chartRef.current) return null;
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error('Chart capture failed', e);
      return null;
    }
  };

  const exportarExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Recorrência Pro';
    wb.created = new Date();

    // Cores
    const HEADER_BG = 'FF10B981';      // emerald
    const HEADER_FG = 'FFFFFFFF';
    const SECTION_BG = 'FFE2E8F0';     // slate-200 (legível)
    const SECTION_FG = 'FF0F172A';     // slate-900
    const TOTAL_BG = 'FFFEF3C7';       // amber-100
    const TOTAL_FG = 'FF92400E';       // amber-800
    const STRIPE_BG = 'FFF8FAFC';
    const BORDER = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } };
    const allBorders = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
    const statusColors: Record<string, { fg: string; bg: string }> = {
      'Pago': { fg: 'FF15803D', bg: 'FFDCFCE7' },
      'A receber': { fg: 'FF334155', bg: 'FFF1F5F9' },
      'Em revisão': { fg: 'FF92400E', bg: 'FFFEF3C7' },
      'Atrasado': { fg: 'FFB91C1C', bg: 'FFFEE2E2' },
    };

    // ===== ÚNICA ABA "Relatório" com tudo =====
    const ws = wb.addWorksheet('Relatório', {
      views: [{ showGridLines: true, state: 'frozen', ySplit: 0 }],
      pageSetup: { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
    });
    ws.columns = [
      { width: 14 },  // A - Data
      { width: 32 },  // B - Cliente
      { width: 24 },  // C - Produto
      { width: 10 },  // D - Parcela
      { width: 16 },  // E - Valor
      { width: 16 },  // F - Status
    ];

    let row = 1;

    // Título
    ws.mergeCells(`A${row}:F${row}`);
    const t = ws.getCell(`A${row}`);
    t.value = 'PREVISÃO DE FATURAMENTO';
    t.font = { name: 'Calibri', size: 18, bold: true, color: { argb: HEADER_FG } };
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    t.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(row).height = 32;
    row++;

    // Período
    ws.mergeCells(`A${row}:F${row}`);
    const p = ws.getCell(`A${row}`);
    p.value = periodoLabel.charAt(0).toUpperCase() + periodoLabel.slice(1);
    p.font = { name: 'Calibri', size: 12, bold: true, color: { argb: SECTION_FG } };
    p.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_BG } };
    p.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(row).height = 22;
    row++;

    // Gerado em
    ws.mergeCells(`A${row}:F${row}`);
    const d = ws.getCell(`A${row}`);
    d.value = `Gerado em: ${hoje.toLocaleString('pt-BR')}`;
    d.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
    d.alignment = { horizontal: 'center' };
    row += 2;

    // ===== RESUMO =====
    if (incluirResumo) {
      ws.mergeCells(`A${row}:F${row}`);
      const sec = ws.getCell(`A${row}`);
      sec.value = '  RESUMO GERAL';
      sec.font = { bold: true, size: 12, color: { argb: SECTION_FG } };
      sec.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_BG } };
      sec.alignment = { vertical: 'middle' };
      ws.getRow(row).height = 22;
      row++;

      // Cabeçalho de duas colunas (label, valor) ocupando A-C / D-F
      const headers = [
        { label: 'Indicador', range: `A${row}:C${row}`, cell: `A${row}` },
        { label: 'Valor', range: `D${row}:F${row}`, cell: `D${row}` },
      ];
      headers.forEach(h => {
        ws.mergeCells(h.range);
        const c = ws.getCell(h.cell);
        c.value = h.label;
        c.font = { bold: true, size: 11, color: { argb: HEADER_FG } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border = allBorders;
      });
      ws.getRow(row).height = 22;
      row++;

      const resumoLinhas: { label: string; value: number | string; isBRL: boolean; tone?: { fg: string; bg: string } }[] = [
        { label: 'Total Geral', value: totais.total, isBRL: true, tone: { fg: 'FF065F46', bg: 'FFD1FAE5' } },
        { label: 'Quantidade de Parcelas', value: totais.qtd, isBRL: false },
        { label: 'Pago', value: totais.pago, isBRL: true, tone: statusColors['Pago'] },
        { label: 'A receber', value: totais.aReceber, isBRL: true, tone: statusColors['A receber'] },
        { label: 'Em revisão', value: totais.emRevisao, isBRL: true, tone: statusColors['Em revisão'] },
        { label: 'Atrasado', value: totais.atrasado, isBRL: true, tone: statusColors['Atrasado'] },
      ];

      resumoLinhas.forEach(item => {
        ws.mergeCells(`A${row}:C${row}`);
        ws.mergeCells(`D${row}:F${row}`);
        const labelC = ws.getCell(`A${row}`);
        const valC = ws.getCell(`D${row}`);
        labelC.value = item.label;
        valC.value = item.value;
        if (item.isBRL) valC.numFmt = 'R$ #,##0.00';
        const bg = item.tone?.bg || 'FFFFFFFF';
        const fg = item.tone?.fg || SECTION_FG;
        [labelC, valC].forEach(c => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          c.font = { bold: true, size: 11, color: { argb: fg } };
          c.border = allBorders;
        });
        labelC.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        valC.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
        ws.getRow(row).height = 22;
        row++;
      });
      row++;
    }

    // ===== GRÁFICO (imagem embedada) =====
    if (incluirGrafico) {
      ws.mergeCells(`A${row}:F${row}`);
      const sec = ws.getCell(`A${row}`);
      sec.value = modo === 'mes' ? '  GRÁFICO • DISTRIBUIÇÃO POR DIA' : '  GRÁFICO • DISTRIBUIÇÃO POR MÊS';
      sec.font = { bold: true, size: 12, color: { argb: SECTION_FG } };
      sec.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_BG } };
      sec.alignment = { vertical: 'middle' };
      ws.getRow(row).height = 22;
      row++;

      const img = await captureChart();
      if (img) {
        const imageId = wb.addImage({ base64: img, extension: 'png' });
        // Reservar espaço de ~16 linhas para a imagem
        const startRow = row;
        for (let i = 0; i < 16; i++) {
          ws.getRow(row).height = 18;
          row++;
        }
        ws.addImage(imageId, {
          tl: { col: 0, row: startRow - 1 },
          ext: { width: 720, height: 280 },
        });
      }

      // Tabela de dados do gráfico (Dia/Mês × Valor)
      row++;
      ws.mergeCells(`A${row}:C${row}`);
      ws.mergeCells(`D${row}:F${row}`);
      const h1 = ws.getCell(`A${row}`);
      const h2 = ws.getCell(`D${row}`);
      h1.value = modo === 'mes' ? 'Dia' : 'Mês';
      h2.value = 'Valor';
      [h1, h2].forEach(c => {
        c.font = { bold: true, size: 11, color: { argb: HEADER_FG } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border = allBorders;
      });
      ws.getRow(row).height = 22;
      row++;

      chartData.forEach((cd, idx) => {
        ws.mergeCells(`A${row}:C${row}`);
        ws.mergeCells(`D${row}:F${row}`);
        const a = ws.getCell(`A${row}`);
        const b = ws.getCell(`D${row}`);
        a.value = cd.dia;
        b.value = cd.valor;
        b.numFmt = 'R$ #,##0.00';
        const bg = idx % 2 === 0 ? 'FFFFFFFF' : STRIPE_BG;
        [a, b].forEach(c => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          c.border = allBorders;
        });
        a.alignment = { horizontal: 'center', vertical: 'middle' };
        b.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
        ws.getRow(row).height = 20;
        row++;
      });
      row++;
    }

    // ===== DETALHES =====
    if (incluirDetalhes && parcelasData.length > 0) {
      ws.mergeCells(`A${row}:F${row}`);
      const sec = ws.getCell(`A${row}`);
      sec.value = '  DETALHES DAS PARCELAS';
      sec.font = { bold: true, size: 12, color: { argb: SECTION_FG } };
      sec.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_BG } };
      sec.alignment = { vertical: 'middle' };
      ws.getRow(row).height = 22;
      row++;

      // Header
      const headers = ['Data', 'Cliente', 'Produto', 'Parcela', 'Valor', 'Status'];
      headers.forEach((h, i) => {
        const c = ws.getCell(row, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: HEADER_FG }, size: 11 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border = allBorders;
      });
      ws.getRow(row).height = 24;
      const headerRow = row;
      row++;

      const detailStartRow = row;
      parcelasData.forEach((p, idx) => {
        const cells = [
          p.data, p.cliente, p.produto, `${p.numeroParcela}/${p.totalParcelas}`, p.valor, p.status,
        ];
        cells.forEach((val, i) => {
          const c = ws.getCell(row, i + 1);
          c.value = val;
          const bg = idx % 2 === 0 ? 'FFFFFFFF' : STRIPE_BG;
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          c.border = allBorders;
          c.font = { size: 10, color: { argb: SECTION_FG } };
          if (i === 4) {
            c.numFmt = 'R$ #,##0.00';
            c.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
            c.font = { size: 10, bold: true, color: { argb: SECTION_FG } };
          } else if (i === 0 || i === 3) {
            c.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
          }
        });
        const sc = statusColors[p.status];
        if (sc) {
          const stCell = ws.getCell(row, 6);
          stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.bg } };
          stCell.font = { bold: true, color: { argb: sc.fg }, size: 10 };
          stCell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        ws.getRow(row).height = 20;
        row++;
      });
      const detailEndRow = row - 1;

      // Linha de TOTAL única ao final
      const totalLabel = ws.getCell(row, 4);
      const totalVal = ws.getCell(row, 5);
      ws.mergeCells(row, 1, row, 4);
      const tl = ws.getCell(row, 1);
      tl.value = 'TOTAL';
      tl.font = { bold: true, size: 12, color: { argb: TOTAL_FG } };
      tl.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
      tl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
      tl.border = allBorders;

      totalVal.value = { formula: `SUM(E${detailStartRow}:E${detailEndRow})` };
      totalVal.numFmt = 'R$ #,##0.00';
      totalVal.font = { bold: true, size: 12, color: { argb: TOTAL_FG } };
      totalVal.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
      totalVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
      totalVal.border = allBorders;

      const emptyF = ws.getCell(row, 6);
      emptyF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
      emptyF.border = allBorders;
      ws.getRow(row).height = 26;

      // Auto-filtro nos cabeçalhos
      ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: 6 } };
      // Congelar linha do cabeçalho de detalhes
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRow, showGridLines: true }];
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `previsao-faturamento-${periodoLabel.replace(/\s/g, '-').toLowerCase()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarCSV = () => {
    const linhas: string[] = [];
    linhas.push(`Relatório de Previsão de Faturamento`);
    linhas.push(`Período;${periodoLabel}`);
    linhas.push(`Gerado em;${hoje.toLocaleString('pt-BR')}`);
    linhas.push('');

    if (incluirResumo) {
      linhas.push('RESUMO');
      linhas.push(`Total Geral;${totais.total.toFixed(2)}`);
      linhas.push(`Quantidade de Parcelas;${totais.qtd}`);
      linhas.push(`Pago;${totais.pago.toFixed(2)}`);
      linhas.push(`A receber;${totais.aReceber.toFixed(2)}`);
      linhas.push(`Em revisão;${totais.emRevisao.toFixed(2)}`);
      linhas.push(`Atrasado;${totais.atrasado.toFixed(2)}`);
      linhas.push('');
    }

    linhas.push('AGREGADO');
    linhas.push(`${modo === 'mes' ? 'Dia' : 'Mês'};Valor`);
    chartData.forEach(d => linhas.push(`${d.dia};${d.valor.toFixed(2)}`));
    linhas.push('');

    if (incluirDetalhes) {
      linhas.push('DETALHES');
      linhas.push('Data;Cliente;Produto;Parcela;Valor;Status');
      parcelasData.forEach(p => {
        linhas.push(`${p.data};${p.cliente};${p.produto};${p.numeroParcela}/${p.totalParcelas};${p.valor.toFixed(2)};${p.status}`);
      });
    }

    const csvContent = '\uFEFF' + linhas.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `previsao-faturamento-${periodoLabel.replace(/\s/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageWidth - margin * 2;
    let y = 0;

    // ===== Header verde no topo (estilo planilha title bar) =====
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('PREVISÃO DE FATURAMENTO', margin, 10);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(periodoLabel.charAt(0).toUpperCase() + periodoLabel.slice(1), margin, 17);
    doc.setFontSize(7.5);
    doc.text(`Gerado em ${hoje.toLocaleString('pt-BR')}`, pageWidth - margin, 17, { align: 'right' });

    y = 28;
    doc.setTextColor(15, 23, 42);

    // ===== Helper: desenha "célula" estilo planilha =====
    const drawCell = (
      x: number, yy: number, w: number, h: number,
      text: string,
      opts: {
        bg?: [number, number, number];
        fg?: [number, number, number];
        bold?: boolean;
        size?: number;
        align?: 'left' | 'right' | 'center';
        border?: boolean;
      } = {}
    ) => {
      const { bg = [255, 255, 255], fg = [15, 23, 42], bold = false, size = 9, align = 'left', border = true } = opts;
      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.rect(x, yy, w, h, 'F');
      if (border) {
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.1);
        doc.rect(x, yy, w, h, 'S');
      }
      doc.setTextColor(fg[0], fg[1], fg[2]);
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const padding = 2;
      const tx = align === 'right' ? x + w - padding : align === 'center' ? x + w / 2 : x + padding;
      doc.text(text, tx, yy + h / 2 + size / 4, { align });
    };

    // Section banner helper (cinza claro com texto escuro - legível)
    const drawSectionBanner = (label: string) => {
      drawCell(margin, y, contentW, 7, label, {
        bg: [226, 232, 240], fg: [15, 23, 42], bold: true, size: 10, align: 'left', border: false,
      });
      y += 7;
    };

    // ===== RESUMO (tabela estilo planilha) =====
    if (incluirResumo) {
      drawSectionBanner('  RESUMO GERAL');

      const colW1 = contentW * 0.55;
      const colW2 = contentW * 0.45;
      const rowH = 8;

      // Header da tabela resumo (verde com texto branco — só nos headers de tabela)
      drawCell(margin, y, colW1, rowH, 'Indicador', { bg: [16, 185, 129], fg: [255, 255, 255], bold: true, size: 9, align: 'center' });
      drawCell(margin + colW1, y, colW2, rowH, 'Valor', { bg: [16, 185, 129], fg: [255, 255, 255], bold: true, size: 9, align: 'center' });
      y += rowH;

      const resumoLinhas = [
        { label: 'Total Geral', value: formatBRL(totais.total), color: [6, 95, 70] as [number, number, number], bg: [209, 250, 229] as [number, number, number] },
        { label: 'Quantidade de Parcelas', value: String(totais.qtd), color: [15, 23, 42] as [number, number, number] },
        { label: 'Pago', value: formatBRL(totais.pago), color: [21, 128, 61] as [number, number, number], bg: [220, 252, 231] as [number, number, number] },
        { label: 'A receber', value: formatBRL(totais.aReceber), color: [51, 65, 85] as [number, number, number], bg: [241, 245, 249] as [number, number, number] },
        { label: 'Em revisão', value: formatBRL(totais.emRevisao), color: [146, 64, 14] as [number, number, number], bg: [254, 243, 199] as [number, number, number] },
        { label: 'Atrasado', value: formatBRL(totais.atrasado), color: [185, 28, 28] as [number, number, number], bg: [254, 226, 226] as [number, number, number] },
      ];
      resumoLinhas.forEach((r, i) => {
        const bg = r.bg || ((i % 2 === 0 ? [255, 255, 255] : [248, 250, 252]) as [number, number, number]);
        drawCell(margin, y, colW1, rowH, r.label, { bg, bold: true, size: 9 });
        drawCell(margin + colW1, y, colW2, rowH, r.value, { bg, fg: r.color, bold: true, size: 10, align: 'right' });
        y += rowH;
      });
      y += 4;
    }

    // ===== GRÁFICO =====
    if (incluirGrafico) {
      const img = await captureChart();
      if (img) {
        if (y + 85 > pageHeight - 15) { doc.addPage(); y = 15; }
        drawSectionBanner(modo === 'mes' ? '  GRÁFICO • DISTRIBUIÇÃO POR DIA' : '  GRÁFICO • DISTRIBUIÇÃO POR MÊS');
        // White panel
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.rect(margin, y, contentW, 75, 'FD');
        doc.addImage(img, 'PNG', margin + 2, y + 2, contentW - 4, 71);
        y += 78;
      }
    }

    // ===== DETALHES (tabela com look de planilha) =====
    if (incluirDetalhes && parcelasData.length > 0) {
      if (y + 20 > pageHeight - 15) { doc.addPage(); y = 15; }
      drawSectionBanner('  DETALHES DAS PARCELAS');

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Data', 'Cliente', 'Produto', 'Parc.', 'Valor', 'Status']],
        body: parcelasData.map(p => [
          p.data, p.cliente, p.produto, `${p.numeroParcela}/${p.totalParcelas}`, formatBRL(p.valor), p.status,
        ]),
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          lineColor: [203, 213, 225],
          lineWidth: 0.1,
          textColor: [15, 23, 42],
        },
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 38 },
          3: { cellWidth: 14, halign: 'center' },
          4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
          5: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 5) {
            const status = data.cell.raw as string;
            const colorMap: Record<string, { fg: [number, number, number]; bg: [number, number, number] }> = {
              'Pago': { fg: [21, 128, 61], bg: [220, 252, 231] },
              'A receber': { fg: [51, 65, 85], bg: [241, 245, 249] },
              'Atrasado': { fg: [185, 28, 28], bg: [254, 226, 226] },
              'Em revisão': { fg: [146, 64, 14], bg: [254, 243, 199] },
            };
            const c = colorMap[status];
            if (c) {
              data.cell.styles.textColor = c.fg;
              data.cell.styles.fillColor = c.bg;
            }
          }
        },
      });

      // Linha de TOTAL única após toda a tabela (não repete por página)
      // @ts-expect-error finalY is added by autotable
      const finalY = (doc as any).lastAutoTable?.finalY ?? y;
      let ty = finalY;
      if (ty + 10 > pageHeight - 12) { doc.addPage(); ty = 15; }
      const totalRowH = 9;
      // Label area (col 1-4): A4-D4
      const labelW = 22 + (contentW - 22 - 38 - 14 - 26 - 24) + 38 + 14;
      const valueW = 26;
      const restW = 24;
      drawCell(margin, ty, labelW, totalRowH, 'TOTAL GERAL', {
        bg: [254, 243, 199], fg: [146, 64, 14], bold: true, size: 11, align: 'right',
      });
      drawCell(margin + labelW, ty, valueW, totalRowH, formatBRL(totais.total), {
        bg: [254, 243, 199], fg: [146, 64, 14], bold: true, size: 11, align: 'right',
      });
      drawCell(margin + labelW + valueW, ty, restW, totalRowH, '', {
        bg: [254, 243, 199], border: true,
      });
      y = ty + totalRowH;
    }

    // ===== Footer com números de página =====
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Recorrência Pro', margin, pageHeight - 6);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }

    doc.save(`previsao-faturamento-${periodoLabel.replace(/\s/g, '-').toLowerCase()}.pdf`);
  };

  const handleExportar = async () => {
    if (parcelasData.length === 0) {
      toast.error('Nenhum dado para exportar com os filtros selecionados');
      return;
    }
    setExportando(true);
    try {
      if (formato === 'excel') await exportarExcel();
      else if (formato === 'csv') exportarCSV();
      else await exportarPDF();
      toast.success('Relatório exportado com sucesso!');
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao exportar relatório');
    } finally {
      setExportando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Exportar Previsão de Faturamento
          </DialogTitle>
          <DialogDescription>
            Configure as opções e baixe o relatório no formato desejado
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-5 py-2">
            {/* Format */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">Formato do arquivo</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 'pdf' as const, icon: FileText, label: 'PDF', desc: 'Visual completo' },
                  { v: 'excel' as const, icon: FileSpreadsheet, label: 'Excel', desc: '.xlsx editável' },
                  { v: 'csv' as const, icon: FileType, label: 'CSV', desc: 'Dados puros' },
                ].map(f => (
                  <button
                    key={f.v}
                    type="button"
                    onClick={() => setFormato(f.v)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      formato === f.v
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <f.icon className={`w-5 h-5 mb-1.5 ${formato === f.v ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="font-semibold text-sm">{f.label}</div>
                    <div className="text-xs text-muted-foreground">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Period */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">Período</Label>
              <RadioGroup value={modo} onValueChange={(v) => setModo(v as ModoExport)} className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <RadioGroupItem value="mes" id="mes" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="mes" className="cursor-pointer">Mês específico</Label>
                    {modo === 'mes' && (
                      <div className="flex gap-2">
                        <Select value={String(mesSelecionado)} onValueChange={(v) => setMesSelecionado(Number(v))}>
                          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {meses.map((m, i) => (
                              <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={String(anoSelecionado)} onValueChange={(v) => setAnoSelecionado(Number(v))}>
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <RadioGroupItem value="periodo" id="periodo" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="periodo" className="cursor-pointer">Próximos meses</Label>
                    {modo === 'periodo' && (
                      <Select value={String(mesesPeriodo)} onValueChange={(v) => setMesesPeriodo(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[3, 6, 12, 24].map(m => (
                            <SelectItem key={m} value={String(m)}>{m} meses</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Status filter */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">Status incluídos</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['Pago', 'A receber', 'Em revisão', 'Atrasado'] as const).map(s => (
                  <label
                    key={s}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-border cursor-pointer hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={statusSelecionados.has(s)}
                      onCheckedChange={() => toggleStatus(s)}
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[s] }}
                    />
                    <span className="text-sm">{s}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sections */}
            <div>
              <Label className="text-sm font-semibold mb-3 block">Seções do relatório</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border cursor-pointer hover:bg-accent/50">
                  <Checkbox checked={incluirResumo} onCheckedChange={(v) => setIncluirResumo(!!v)} />
                  <span className="text-sm">Resumo executivo (totais por status)</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border cursor-pointer hover:bg-accent/50">
                  <Checkbox checked={incluirGrafico} onCheckedChange={(v) => setIncluirGrafico(!!v)} />
                  <span className="text-sm">
                    Gráfico visual {formato === 'csv' && <span className="text-xs text-muted-foreground">(não disponível em CSV)</span>}
                  </span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border cursor-pointer hover:bg-accent/50">
                  <Checkbox checked={incluirDetalhes} onCheckedChange={(v) => setIncluirDetalhes(!!v)} />
                  <span className="text-sm">Detalhes parcela a parcela</span>
                </label>
              </div>
            </div>

            {/* Preview info */}
            <div className="bg-muted/30 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parcelas no relatório:</span>
                <span className="font-semibold">{totais.qtd}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Valor total:</span>
                <span className="font-semibold text-primary">{formatBRL(totais.total)}</span>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Hidden chart for capture */}
        <div style={{ position: 'absolute', left: '-99999px', top: 0, width: '900px', height: '400px', background: '#fff' }}>
          <div ref={chartRef} style={{ width: '900px', height: '400px', padding: '20px', background: '#fff' }}>
            <h3 style={{ margin: 0, marginBottom: 12, fontFamily: 'Arial', fontSize: 16, color: '#0f172a' }}>
              Previsão • {periodoLabel}
            </h3>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                <XAxis dataKey="dia" tick={{ fill: '#475569', fontSize: 11 }} />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 11 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill="#10b981" />
                  ))}
                  <LabelList
                    dataKey="valor"
                    position="top"
                    formatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v.toFixed(0))}
                    style={{ fill: '#0f172a', fontSize: 10, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exportando}>
            Cancelar
          </Button>
          <Button onClick={handleExportar} disabled={exportando || parcelasData.length === 0} className="gap-2">
            {exportando ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
            ) : (
              <><Download className="w-4 h-4" /> Baixar {formato.toUpperCase()}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
