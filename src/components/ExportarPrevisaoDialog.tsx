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
    const wb = XLSX.utils.book_new();

    // Summary sheet
    if (incluirResumo) {
      const resumoData = [
        ['Relatório de Previsão de Faturamento'],
        [`Período: ${periodoLabel}`],
        [`Gerado em: ${hoje.toLocaleString('pt-BR')}`],
        [],
        ['Resumo Geral'],
        ['Total Geral', totais.total],
        ['Quantidade de Parcelas', totais.qtd],
        [],
        ['Por Status'],
        ['Pago', totais.pago],
        ['A receber', totais.aReceber],
        ['Em revisão', totais.emRevisao],
        ['Atrasado', totais.atrasado],
      ];
      const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
      wsResumo['!cols'] = [{ wch: 30 }, { wch: 20 }];
      // Format currency cells
      ['B6', 'B10', 'B11', 'B12', 'B13'].forEach(cell => {
        if (wsResumo[cell]) wsResumo[cell].z = 'R$ #,##0.00';
      });
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
    }

    // Chart data sheet (aggregated)
    const aggData = [
      [modo === 'mes' ? 'Dia' : 'Mês', 'Valor (R$)'],
      ...chartData.map(d => [d.dia, d.valor]),
      ['Total', totais.total],
    ];
    const wsAgg = XLSX.utils.aoa_to_sheet(aggData);
    wsAgg['!cols'] = [{ wch: 15 }, { wch: 18 }];
    for (let i = 2; i <= chartData.length + 2; i++) {
      const cell = `B${i}`;
      if (wsAgg[cell]) wsAgg[cell].z = 'R$ #,##0.00';
    }
    XLSX.utils.book_append_sheet(wb, wsAgg, 'Gráfico');

    // Details
    if (incluirDetalhes) {
      const detData = [
        ['Data', 'Cliente', 'Produto', 'Parcela', 'Valor (R$)', 'Status'],
        ...parcelasData.map(p => [
          p.data,
          p.cliente,
          p.produto,
          `${p.numeroParcela}/${p.totalParcelas}`,
          p.valor,
          p.status,
        ]),
      ];
      const wsDet = XLSX.utils.aoa_to_sheet(detData);
      wsDet['!cols'] = [
        { wch: 12 }, { wch: 30 }, { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 14 }
      ];
      for (let i = 2; i <= parcelasData.length + 1; i++) {
        const cell = `E${i}`;
        if (wsDet[cell]) wsDet[cell].z = 'R$ #,##0.00';
      }
      XLSX.utils.book_append_sheet(wb, wsDet, 'Detalhes');
    }

    // Embed chart image as separate sheet (image is supported via aoa with cell comments hack — use image embed via SheetJS Pro is not in OSS)
    // Instead, write a note that chart is in PDF
    if (incluirGrafico) {
      const img = await captureChart();
      if (img) {
        // SheetJS community doesn't natively embed images well. Add a note sheet.
        const wsNote = XLSX.utils.aoa_to_sheet([
          ['Visualização Gráfica'],
          ['Os dados do gráfico estão na aba "Gráfico". Para visualização gráfica, use o formato PDF.'],
        ]);
        XLSX.utils.book_append_sheet(wb, wsNote, 'Sobre Gráfico');
      }
    }

    XLSX.writeFile(wb, `previsao-faturamento-${periodoLabel.replace(/\s/g, '-').toLowerCase()}.xlsx`);
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
    let y = 15;

    // Header
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Previsão de Faturamento', 14, 14);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(periodoLabel.charAt(0).toUpperCase() + periodoLabel.slice(1), 14, 22);
    doc.setFontSize(8);
    doc.text(`Gerado em ${hoje.toLocaleString('pt-BR')}`, pageWidth - 14, 22, { align: 'right' });

    y = 40;
    doc.setTextColor(0, 0, 0);

    // Summary cards
    if (incluirResumo) {
      const cards = [
        { label: 'Total Geral', value: formatBRL(totais.total), color: [16, 185, 129] },
        { label: 'Pago', value: formatBRL(totais.pago), color: [22, 163, 74] },
        { label: 'A receber', value: formatBRL(totais.aReceber), color: [148, 163, 184] },
        { label: 'Em atraso', value: formatBRL(totais.atrasado), color: [220, 38, 38] },
      ];
      const cardW = (pageWidth - 28 - 9) / 4;
      cards.forEach((c, i) => {
        const x = 14 + i * (cardW + 3);
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(x, y, cardW, 22, 2, 2, 'F');
        doc.setFillColor(c.color[0], c.color[1], c.color[2]);
        doc.roundedRect(x, y, 2, 22, 1, 1, 'F');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(c.label, x + 5, y + 7);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(c.value, x + 5, y + 16);
        doc.setFont('helvetica', 'normal');
      });
      y += 30;
    }

    // Chart image
    if (incluirGrafico) {
      const img = await captureChart();
      if (img) {
        const imgW = pageWidth - 28;
        const imgH = 70;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Distribuição', 14, y);
        y += 5;
        doc.addImage(img, 'PNG', 14, y, imgW, imgH);
        y += imgH + 8;
      }
    }

    // Details table
    if (incluirDetalhes && parcelasData.length > 0) {
      if (y > 240) { doc.addPage(); y = 15; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Detalhes das Parcelas', 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [['Data', 'Cliente', 'Produto', 'Parc.', 'Valor', 'Status']],
        body: parcelasData.map(p => [
          p.data,
          p.cliente,
          p.produto,
          `${p.numeroParcela}/${p.totalParcelas}`,
          formatBRL(p.valor),
          p.status,
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 22 },
          3: { cellWidth: 14, halign: 'center' },
          4: { cellWidth: 26, halign: 'right' },
          5: { cellWidth: 22, halign: 'center' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 5) {
            const status = data.cell.raw as string;
            const colorMap: Record<string, [number, number, number]> = {
              'Pago': [22, 163, 74],
              'A receber': [100, 116, 139],
              'Atrasado': [220, 38, 38],
              'Em revisão': [202, 138, 4],
            };
            if (colorMap[status]) {
              data.cell.styles.textColor = colorMap[status];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
    }

    // Footer page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${pageCount} • Recorrência Pro`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
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
