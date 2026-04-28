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

    // ========== ABA RESUMO ==========
    if (incluirResumo) {
      const ws = wb.addWorksheet('Resumo', {
        views: [{ showGridLines: false }],
      });
      ws.columns = [{ width: 35 }, { width: 22 }];

      // Title banner
      ws.mergeCells('A1:B1');
      const titleCell = ws.getCell('A1');
      titleCell.value = 'PREVISÃO DE FATURAMENTO';
      titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(1).height = 30;

      ws.mergeCells('A2:B2');
      const subCell = ws.getCell('A2');
      subCell.value = periodoLabel.charAt(0).toUpperCase() + periodoLabel.slice(1);
      subCell.font = { name: 'Calibri', size: 11, color: { argb: 'FFFFFFFF' } };
      subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      subCell.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(2).height = 22;

      ws.mergeCells('A3:B3');
      const dateCell = ws.getCell('A3');
      dateCell.value = `Gerado em: ${hoje.toLocaleString('pt-BR')}`;
      dateCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
      dateCell.alignment = { horizontal: 'center' };

      // Section header: Resumo Geral
      ws.getCell('A5').value = 'RESUMO GERAL';
      ws.mergeCells('A5:B5');
      const sec1 = ws.getCell('A5');
      sec1.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      sec1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      sec1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getRow(5).height = 22;

      const resumoRows = [
        ['Total Geral', totais.total, 'FF10B981'],
        ['Quantidade de Parcelas', totais.qtd, null],
      ];
      resumoRows.forEach(([label, value, color], idx) => {
        const r = 6 + idx;
        ws.getCell(`A${r}`).value = label as string;
        ws.getCell(`B${r}`).value = value as number;
        ws.getCell(`A${r}`).font = { bold: true, size: 11 };
        ws.getCell(`B${r}`).font = { bold: true, size: 11, color: color ? { argb: color as string } : undefined };
        if (typeof value === 'number' && label !== 'Quantidade de Parcelas') {
          ws.getCell(`B${r}`).numFmt = 'R$ #,##0.00';
        }
        ws.getCell(`A${r}`).alignment = { indent: 1 };
        ws.getCell(`B${r}`).alignment = { horizontal: 'right' };
        [`A${r}`, `B${r}`].forEach(c => {
          ws.getCell(c).border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          ws.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
        ws.getRow(r).height = 22;
      });

      // Section: Por Status
      ws.getCell('A9').value = 'POR STATUS';
      ws.mergeCells('A9:B9');
      const sec2 = ws.getCell('A9');
      sec2.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      sec2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      sec2.alignment = { vertical: 'middle', indent: 1 };
      ws.getRow(9).height = 22;

      const statusRows = [
        { label: 'Pago', value: totais.pago, color: 'FF16A34A', bg: 'FFDCFCE7' },
        { label: 'A receber', value: totais.aReceber, color: 'FF64748B', bg: 'FFF1F5F9' },
        { label: 'Em revisão', value: totais.emRevisao, color: 'FFCA8A04', bg: 'FFFEF9C3' },
        { label: 'Atrasado', value: totais.atrasado, color: 'FFDC2626', bg: 'FFFEE2E2' },
      ];
      statusRows.forEach((s, idx) => {
        const r = 10 + idx;
        ws.getCell(`A${r}`).value = s.label;
        ws.getCell(`B${r}`).value = s.value;
        ws.getCell(`B${r}`).numFmt = 'R$ #,##0.00';
        ws.getCell(`A${r}`).font = { bold: true, color: { argb: s.color } };
        ws.getCell(`B${r}`).font = { bold: true, color: { argb: s.color } };
        ws.getCell(`A${r}`).alignment = { indent: 1 };
        ws.getCell(`B${r}`).alignment = { horizontal: 'right' };
        [`A${r}`, `B${r}`].forEach(c => {
          ws.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } };
          ws.getCell(c).border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
        ws.getRow(r).height = 22;
      });

      // Embed chart image if requested
      if (incluirGrafico) {
        const img = await captureChart();
        if (img) {
          const imageId = wb.addImage({ base64: img, extension: 'png' });
          ws.addImage(imageId, {
            tl: { col: 2.2, row: 0 },
            ext: { width: 600, height: 320 },
          });
          ws.getColumn(3).width = 2;
        }
      }
    }

    // ========== ABA GRÁFICO (DADOS) ==========
    {
      const ws = wb.addWorksheet('Dados do Gráfico', {
        views: [{ showGridLines: false }],
      });
      ws.columns = [{ width: 18 }, { width: 22 }];

      // Header
      const hdr = ws.getRow(1);
      hdr.values = [modo === 'mes' ? 'Dia' : 'Mês', 'Valor (R$)'];
      hdr.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border = {
          top: { style: 'thin', color: { argb: 'FF059669' } },
          bottom: { style: 'thin', color: { argb: 'FF059669' } },
          left: { style: 'thin', color: { argb: 'FF059669' } },
          right: { style: 'thin', color: { argb: 'FF059669' } },
        };
      });
      hdr.height = 24;

      chartData.forEach((d, idx) => {
        const r = ws.addRow([d.dia, d.valor]);
        r.getCell(2).numFmt = 'R$ #,##0.00';
        const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
        r.eachCell(c => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          c.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
        r.getCell(1).alignment = { horizontal: 'center' };
        r.getCell(2).alignment = { horizontal: 'right' };
      });

      // Total row
      const totalRow = ws.addRow(['TOTAL', totais.total]);
      totalRow.getCell(2).numFmt = 'R$ #,##0.00';
      totalRow.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        c.border = {
          top: { style: 'medium', color: { argb: 'FF10B981' } },
          bottom: { style: 'thin', color: { argb: 'FF1E293B' } },
          left: { style: 'thin', color: { argb: 'FF1E293B' } },
          right: { style: 'thin', color: { argb: 'FF1E293B' } },
        };
      });
      totalRow.getCell(1).alignment = { horizontal: 'center' };
      totalRow.getCell(2).alignment = { horizontal: 'right' };
      totalRow.height = 24;
    }

    // ========== ABA DETALHES ==========
    if (incluirDetalhes) {
      const ws = wb.addWorksheet('Detalhes', {
        views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }],
      });
      ws.columns = [
        { width: 14 }, { width: 32 }, { width: 26 }, { width: 12 }, { width: 16 }, { width: 16 },
      ];

      // Header
      const hdr = ws.getRow(1);
      hdr.values = ['Data', 'Cliente', 'Produto', 'Parcela', 'Valor', 'Status'];
      hdr.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border = {
          top: { style: 'thin', color: { argb: 'FF059669' } },
          bottom: { style: 'thin', color: { argb: 'FF059669' } },
          left: { style: 'thin', color: { argb: 'FF059669' } },
          right: { style: 'thin', color: { argb: 'FF059669' } },
        };
      });
      hdr.height = 26;

      const statusColors: Record<string, { fg: string; bg: string }> = {
        'Pago': { fg: 'FF16A34A', bg: 'FFDCFCE7' },
        'A receber': { fg: 'FF64748B', bg: 'FFF1F5F9' },
        'Em revisão': { fg: 'FFCA8A04', bg: 'FFFEF9C3' },
        'Atrasado': { fg: 'FFDC2626', bg: 'FFFEE2E2' },
      };

      parcelasData.forEach((p, idx) => {
        const r = ws.addRow([
          p.data, p.cliente, p.produto, `${p.numeroParcela}/${p.totalParcelas}`, p.valor, p.status,
        ]);
        const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
        r.eachCell((c, col) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          c.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          if (col === 5) {
            c.numFmt = 'R$ #,##0.00';
            c.alignment = { horizontal: 'right' };
            c.font = { bold: true };
          } else if (col === 1 || col === 4) {
            c.alignment = { horizontal: 'center' };
          }
        });
        // Status pill
        const statusCell = r.getCell(6);
        const sc = statusColors[p.status];
        if (sc) {
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.bg } };
          statusCell.font = { bold: true, color: { argb: sc.fg }, size: 10 };
          statusCell.alignment = { horizontal: 'center' };
        }
        r.height = 20;
      });

      // Footer total
      const lastRow = ws.addRow(['', '', '', 'TOTAL', totais.total, '']);
      lastRow.getCell(5).numFmt = 'R$ #,##0.00';
      lastRow.eachCell((c, col) => {
        if (col === 4 || col === 5) {
          c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
          c.alignment = { horizontal: col === 5 ? 'right' : 'center' };
          c.border = {
            top: { style: 'medium', color: { argb: 'FF10B981' } },
            bottom: { style: 'thin', color: { argb: 'FF1E293B' } },
            left: { style: 'thin', color: { argb: 'FF1E293B' } },
            right: { style: 'thin', color: { argb: 'FF1E293B' } },
          };
        }
      });
      lastRow.height = 26;

      // Auto-filter on header
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 6 } };
    }

    // Save
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

    // ===== RESUMO (tabela estilo planilha) =====
    if (incluirResumo) {
      // Section banner
      drawCell(margin, y, contentW, 7, 'RESUMO GERAL', {
        bg: [30, 41, 59], fg: [255, 255, 255], bold: true, size: 10, align: 'left', border: false,
      });
      y += 7;

      const colW1 = contentW * 0.55;
      const colW2 = contentW * 0.45;
      const rowH = 8;

      // Header da tabela resumo
      drawCell(margin, y, colW1, rowH, 'Indicador', { bg: [16, 185, 129], fg: [255, 255, 255], bold: true, size: 9 });
      drawCell(margin + colW1, y, colW2, rowH, 'Valor', { bg: [16, 185, 129], fg: [255, 255, 255], bold: true, size: 9, align: 'right' });
      y += rowH;

      const resumoLinhas = [
        { label: 'Total Geral', value: formatBRL(totais.total), color: [16, 185, 129] as [number, number, number], bold: true },
        { label: 'Quantidade de Parcelas', value: String(totais.qtd), color: [15, 23, 42] as [number, number, number] },
        { label: 'Pago', value: formatBRL(totais.pago), color: [22, 163, 74] as [number, number, number], bg: [220, 252, 231] as [number, number, number] },
        { label: 'A receber', value: formatBRL(totais.aReceber), color: [100, 116, 139] as [number, number, number], bg: [241, 245, 249] as [number, number, number] },
        { label: 'Em revisão', value: formatBRL(totais.emRevisao), color: [202, 138, 4] as [number, number, number], bg: [254, 249, 195] as [number, number, number] },
        { label: 'Atrasado', value: formatBRL(totais.atrasado), color: [220, 38, 38] as [number, number, number], bg: [254, 226, 226] as [number, number, number] },
      ];
      resumoLinhas.forEach((r, i) => {
        const bg = r.bg || (i % 2 === 0 ? [255, 255, 255] : [248, 250, 252]) as [number, number, number];
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
        if (y + 78 > pageHeight - 15) { doc.addPage(); y = 15; }
        drawCell(margin, y, contentW, 7, modo === 'mes' ? 'GRÁFICO • DISTRIBUIÇÃO POR DIA' : 'GRÁFICO • DISTRIBUIÇÃO POR MÊS', {
          bg: [30, 41, 59], fg: [255, 255, 255], bold: true, size: 10, border: false,
        });
        y += 7;
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

      drawCell(margin, y, contentW, 7, 'DETALHES DAS PARCELAS', {
        bg: [30, 41, 59], fg: [255, 255, 255], bold: true, size: 10, border: false,
      });
      y += 7;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Data', 'Cliente', 'Produto', 'Parc.', 'Valor', 'Status']],
        body: parcelasData.map(p => [
          p.data, p.cliente, p.produto, `${p.numeroParcela}/${p.totalParcelas}`, formatBRL(p.valor), p.status,
        ]),
        foot: [['', '', '', 'TOTAL', formatBRL(totais.total), '']],
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
        footStyles: {
          fillColor: [30, 41, 59],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
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
              'Pago': { fg: [22, 163, 74], bg: [220, 252, 231] },
              'A receber': { fg: [100, 116, 139], bg: [241, 245, 249] },
              'Atrasado': { fg: [220, 38, 38], bg: [254, 226, 226] },
              'Em revisão': { fg: [202, 138, 4], bg: [254, 249, 195] },
            };
            const c = colorMap[status];
            if (c) {
              data.cell.styles.textColor = c.fg;
              data.cell.styles.fillColor = c.bg;
            }
          }
          if (data.section === 'foot' && data.column.index === 4) {
            data.cell.styles.halign = 'right';
          }
        },
      });
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
