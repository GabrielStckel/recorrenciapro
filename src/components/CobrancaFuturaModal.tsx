import { useState, useEffect } from 'react';
import { CobrancaFutura, CobrancaFuturaInsert, useCobrancasFuturas } from '@/hooks/useCobrancasFuturas';
import { useProdutos } from '@/hooks/useProdutos';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Users } from 'lucide-react';

function formatCurrencyInput(value: string): string {
  const numbers = value.replace(/\D/g, '');
  const amount = parseInt(numbers || '0', 10) / 100;
  if (amount === 0) return '';
  return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBrazilianCurrency(value: string): number {
  if (!value) return 0;
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

function toCents(formatted: string): number {
  const digits = formatted.replace(/\D/g, '');
  return parseInt(digits, 10) || 0;
}

function formatCurrencyFromCents(cents: number): string {
  if (cents === 0) return '';
  const reais = (cents / 100).toFixed(2);
  const [intPart, decPart] = reais.split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFormatted},${decPart}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  cobranca: CobrancaFutura | null;
}

export function CobrancaFuturaModal({ open, onClose, cobranca }: Props) {
  const { addCobranca, updateCobranca } = useCobrancasFuturas();
  const { produtos, addProduto } = useProdutos();
  const isEditing = !!cobranca;

  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [valorVistaDisplay, setValorVistaDisplay] = useState('');
  const [valorTotalDisplay, setValorTotalDisplay] = useState('');
  const [totalParcelas, setTotalParcelas] = useState('');
  const [diaVencimento, setDiaVencimento] = useState('10');
  const [dataEnvio, setDataEnvio] = useState('');
  const [link, setLink] = useState('');
  const [produto, setProduto] = useState('');
  const [observacao, setObservacao] = useState('');
  const [novoProduto, setNovoProduto] = useState('');
  const [showNovoProduto, setShowNovoProduto] = useState(false);

  // Sócio fields
  const [comSocio, setComSocio] = useState(false);
  const [emailSocio, setEmailSocio] = useState('');
  const [percentualUser, setPercentualUser] = useState('50');
  const [percentualParceiro, setPercentualParceiro] = useState('50');

  useEffect(() => {
    if (open) {
      if (cobranca) {
        setNome(cobranca.cliente_nome);
        setWhatsapp(cobranca.whatsapp || '');
        setValorVistaDisplay(formatCurrencyFromCents(Math.round(cobranca.valor_a_vista * 100)));
        setValorTotalDisplay(formatCurrencyFromCents(Math.round((cobranca.valor_total || 0) * 100)));
        setTotalParcelas(cobranca.total_parcelas?.toString() || '');
        setDiaVencimento(cobranca.dia_vencimento?.toString() || '10');
        setDataEnvio(cobranca.data_envio_link);
        setLink(cobranca.link_pagamento || '');
        setProduto(cobranca.produto || '');
        setObservacao(cobranca.observacao || '');
        setComSocio(cobranca.com_socio || false);
        setEmailSocio(cobranca.email_socio || '');
        setPercentualUser(cobranca.percentual_user?.toString() || '50');
        setPercentualParceiro(cobranca.percentual_parceiro?.toString() || '50');
      } else {
        setNome(''); setWhatsapp(''); setValorVistaDisplay(''); setValorTotalDisplay('');
        setTotalParcelas(''); setDiaVencimento('10'); setDataEnvio('');
        setLink(''); setProduto(''); setObservacao('');
        setNovoProduto(''); setShowNovoProduto(false);
        setComSocio(false); setEmailSocio('');
        setPercentualUser('50'); setPercentualParceiro('50');
      }
    }
  }, [open, cobranca]);

  const handlePercentualUserChange = (val: string) => {
    setPercentualUser(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setPercentualParceiro((100 - num).toString());
    }
  };

  const handlePercentualParceiroChange = (val: string) => {
    setPercentualParceiro(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setPercentualUser((100 - num).toString());
    }
  };

  const loading = addCobranca.isPending || updateCobranca.isPending;

  const handleAddProduto = async () => {
    if (!novoProduto.trim()) return;
    await addProduto.mutateAsync(novoProduto.trim());
    setProduto(novoProduto.trim());
    setNovoProduto('');
    setShowNovoProduto(false);
  };

  const handleSubmit = () => {
    if (!nome || !dataEnvio) return;
    const payload: CobrancaFuturaInsert = {
      cliente_nome: nome.trim(),
      whatsapp: whatsapp || null,
      valor_a_vista: parseBrazilianCurrency(valorVistaDisplay),
      valor_total: parseBrazilianCurrency(valorTotalDisplay),
      total_parcelas: parseInt(totalParcelas, 10) || 1,
      dia_vencimento: parseInt(diaVencimento, 10) || 10,
      data_envio_link: dataEnvio,
      link_pagamento: link || null,
      produto: produto || null,
      observacao: observacao || null,
      com_socio: comSocio,
      email_socio: comSocio ? emailSocio || null : null,
      percentual_user: comSocio ? parseFloat(percentualUser) || 50 : 50,
      percentual_parceiro: comSocio ? parseFloat(percentualParceiro) || 50 : 50,
    };

    if (isEditing) {
      updateCobranca.mutate({ id: cobranca!.id, ...payload }, { onSuccess: onClose });
    } else {
      addCobranca.mutate(payload, { onSuccess: onClose });
    }
  };

  // Preview de valores com sócio
  const valorTotal = parseBrazilianCurrency(valorTotalDisplay);
  const pctUser = parseFloat(percentualUser) || 0;
  const pctParceiro = parseFloat(percentualParceiro) || 0;
  const showPreview = comSocio && valorTotal > 0 && pctUser > 0 && pctParceiro > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Nova'} Cobrança Futura</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome do Cliente *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" />
          </div>

          {/* Produto com opção de criar novo */}
          <div className="grid gap-2">
            <Label>Produto</Label>
            {showNovoProduto ? (
              <div className="flex gap-2">
                <Input
                  value={novoProduto}
                  onChange={(e) => setNovoProduto(e.target.value)}
                  placeholder="Nome do novo produto"
                  className="flex-1"
                />
                <Button type="button" size="sm" onClick={handleAddProduto} disabled={addProduto.isPending}>
                  {addProduto.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowNovoProduto(false)}>
                  ✕
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={produto} onValueChange={setProduto}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setShowNovoProduto(true)} title="Adicionar novo produto">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor Pago à Vista (R$)</Label>
              <Input
                value={valorVistaDisplay}
                onChange={(e) => {
                  const cents = toCents(e.target.value);
                  setValorVistaDisplay(formatCurrencyFromCents(cents));
                }}
                placeholder="0,00"
                inputMode="numeric"
              />
            </div>
            <div>
              <Label>Valor Total Recorrência (R$)</Label>
              <Input
                value={valorTotalDisplay}
                onChange={(e) => {
                  const cents = toCents(e.target.value);
                  setValorTotalDisplay(formatCurrencyFromCents(cents));
                }}
                placeholder="0,00"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total Parcelas</Label>
              <Input
                type="number"
                min="1"
                max="48"
                value={totalParcelas}
                onChange={(e) => setTotalParcelas(e.target.value)}
                placeholder="12"
              />
            </div>
            <div>
              <Label>Dia Vencimento (1-31)</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={diaVencimento}
                onChange={(e) => setDiaVencimento(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Data para Enviar o Link *</Label>
            <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
          </div>
          <div>
            <Label>Link de Pagamento</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>

          {/* Seção sócio */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="com-socio-cobranca" className="flex items-center gap-2 cursor-pointer">
                <Users className="w-4 h-4 text-primary" />
                Adicionar sócio
              </Label>
              <Switch
                id="com-socio-cobranca"
                checked={comSocio}
                onCheckedChange={setComSocio}
              />
            </div>

            {comSocio && (
              <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="grid gap-2">
                  <Label className="text-xs">Email do sócio</Label>
                  <Input
                    type="email"
                    placeholder="socio@email.com"
                    value={emailSocio}
                    onChange={(e) => setEmailSocio(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label className="text-xs">Meu %</Label>
                    <Input
                      type="number"
                      min="1"
                      max="99"
                      value={percentualUser}
                      onChange={(e) => handlePercentualUserChange(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Sócio %</Label>
                    <Input
                      type="number"
                      min="1"
                      max="99"
                      value={percentualParceiro}
                      onChange={(e) => handlePercentualParceiroChange(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                {showPreview && (
                  <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                    <p>Meu valor: <span className="font-medium text-foreground">R$ {(valorTotal * pctUser / 100).toFixed(2).replace('.', ',')}</span></p>
                    <p>Sócio: <span className="font-medium text-foreground">R$ {(valorTotal * pctParceiro / 100).toFixed(2).replace('.', ',')}</span></p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !nome || !dataEnvio}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
