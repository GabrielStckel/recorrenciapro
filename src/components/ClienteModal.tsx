import { useState, useEffect } from 'react';
import { ClienteCalculado, StatusCliente } from '@/types/cliente';
import { useClientes } from '@/hooks/useClientes';
import { useProdutos } from '@/hooks/useProdutos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Users } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Função para converter valor brasileiro para número
function parseBrazilianCurrency(value: string): number {
  if (!value || typeof value !== 'string') return NaN;
  let cleaned = value
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(cleaned);
}

function formatCurrencyInput(cents: number): string {
  if (cents === 0) return '';
  const reais = (cents / 100).toFixed(2);
  const [intPart, decPart] = reais.split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFormatted},${decPart}`;
}

function toCents(formatted: string): number {
  const digits = formatted.replace(/\D/g, '');
  return parseInt(digits, 10) || 0;
}

function formatDateOnlyISO(date: Date): string {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

const clienteSchema = z.object({
  cliente_nome: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  whatsapp: z.string().max(20, 'WhatsApp muito longo').optional(),
  produto: z.string().min(1, 'Produto é obrigatório').max(100, 'Nome do produto muito longo'),
  valor_total: z.number({
    required_error: 'Valor total é obrigatório',
    invalid_type_error: 'Digite um valor válido, ex: 1636,20',
  }).positive('Valor deve ser maior que zero'),
  total_parcelas: z.number({
    required_error: 'Total de parcelas é obrigatório',
    invalid_type_error: 'Digite um número válido',
  }).int('Parcelas deve ser número inteiro').positive('Parcelas deve ser maior que zero').max(48, 'Máximo de 48 parcelas'),
  dia_vencimento: z.number({
    required_error: 'Dia de vencimento é obrigatório',
    invalid_type_error: 'Digite um dia válido',
  }).int('Dia deve ser número inteiro').min(1, 'Dia deve ser entre 1 e 31').max(31, 'Dia deve ser entre 1 e 31'),
});

interface ClienteModalProps {
  open: boolean;
  onClose: () => void;
  cliente?: ClienteCalculado | null;
  prefilledCobranca?: { cliente_nome?: string; whatsapp?: string | null; produto?: string | null } | null;
}

export function ClienteModal({ open, onClose, cliente, prefilledCobranca }: ClienteModalProps) {
  const { addCliente, updateCliente } = useClientes();
  const { produtos, addProduto } = useProdutos();
  const { toast } = useToast();
  const [novoProduto, setNovoProduto] = useState('');
  const [showNovoProduto, setShowNovoProduto] = useState(false);
  const [comSocio, setComSocio] = useState(false);
  const [emailSocio, setEmailSocio] = useState('');
  const [percentualUser, setPercentualUser] = useState('50');
  const [percentualParceiro, setPercentualParceiro] = useState('50');
  const [isSavingWithPartner, setIsSavingWithPartner] = useState(false);
  const [formData, setFormData] = useState({
    cliente_nome: '',
    whatsapp: '',
    produto: '',
    valor_total: '',
    total_parcelas: '',
    parcelas_pagas: '0',
    dia_vencimento: '10',
    data_inicio: formatDateOnlyISO(new Date()),
    status_cliente: 'ATIVO' as StatusCliente,
  });

  useEffect(() => {
    if (cliente) {
      setFormData({
        cliente_nome: cliente.cliente_nome,
        whatsapp: cliente.whatsapp || '',
        produto: cliente.produto,
        valor_total: formatCurrencyInput(Math.round(cliente.valor_total * 100)),
        total_parcelas: cliente.total_parcelas.toString(),
        parcelas_pagas: cliente.parcelas_pagas.toString(),
        dia_vencimento: cliente.dia_vencimento.toString(),
        data_inicio: cliente.data_inicio,
        status_cliente: cliente.status_cliente || 'ATIVO',
      });
      setComSocio(false);
    } else {
      setFormData({
        cliente_nome: '',
        whatsapp: '',
        produto: '',
        valor_total: '',
        total_parcelas: '',
        parcelas_pagas: '0',
        dia_vencimento: '10',
        data_inicio: formatDateOnlyISO(new Date()),
        status_cliente: 'ATIVO',
      });
      setComSocio(false);
      setEmailSocio('');
      setPercentualUser('50');
      setPercentualParceiro('50');
    }
  }, [cliente, open]);

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

  const handleSubmit = async () => {
    try {
      const valorParsed = parseBrazilianCurrency(formData.valor_total);
      
      if (isNaN(valorParsed)) {
        toast({ title: 'Erro de validação', description: 'Digite um valor válido, ex: 1636,20', variant: 'destructive' });
        return;
      }

      const totalParcelasParsed = parseInt(formData.total_parcelas, 10);
      const parcelasPagasParsed = parseInt(formData.parcelas_pagas, 10);
      const diaVencimentoParsed = parseInt(formData.dia_vencimento, 10);

      if (!Number.isInteger(totalParcelasParsed) || totalParcelasParsed <= 0) {
        toast({ title: 'Erro de validação', description: 'Total de parcelas deve ser um número inteiro maior que zero.', variant: 'destructive' });
        return;
      }

      if (!Number.isInteger(parcelasPagasParsed) || parcelasPagasParsed < 0) {
        toast({ title: 'Erro de validação', description: 'Parcelas pagas deve ser um número inteiro maior ou igual a zero.', variant: 'destructive' });
        return;
      }

      if (!Number.isInteger(diaVencimentoParsed) || diaVencimentoParsed < 1 || diaVencimentoParsed > 31) {
        toast({ title: 'Erro de validação', description: 'Dia de vencimento deve estar entre 1 e 31.', variant: 'destructive' });
        return;
      }

      const baseData = {
        cliente_nome: formData.cliente_nome.trim(),
        whatsapp: formData.whatsapp.trim() || '',
        produto: formData.produto.trim(),
        valor_total: valorParsed,
        total_parcelas: totalParcelasParsed,
        parcelas_pagas: parcelasPagasParsed,
        dia_vencimento: diaVencimentoParsed,
        data_inicio: formData.data_inicio,
        status_cliente: formData.status_cliente,
      };

      const datesChanged = cliente && (
        diaVencimentoParsed !== cliente.dia_vencimento || 
        formData.data_inicio !== cliente.data_inicio
      );

      const data = {
        ...baseData,
        data_ultimo_pagamento: cliente ? cliente.data_ultimo_pagamento : null,
        em_revisao: cliente ? (datesChanged ? false : cliente.em_revisao) : false,
        mes_referencia_revisao: cliente ? (datesChanged ? null : cliente.mes_referencia_revisao) : null,
        valor_pago_parcial: cliente ? (datesChanged ? null : cliente.valor_pago_parcial) : null,
        observacao_revisao: cliente ? (datesChanged ? null : cliente.observacao_revisao) : null,
      };

      const result = clienteSchema.safeParse(data);
      if (!result.success) {
        toast({ title: 'Erro de validação', description: result.error.errors[0].message, variant: 'destructive' });
        return;
      }

      if (cliente) {
        // Edit mode - no partner creation
        await updateCliente.mutateAsync({ id: cliente.id, ...data });
        toast({ title: 'Cliente atualizado com sucesso!' });
      } else if (comSocio) {
        // New client with partner
        if (!emailSocio.trim()) {
          toast({ title: 'Erro', description: 'Informe o email do sócio', variant: 'destructive' });
          return;
        }
        const pctUser = parseFloat(percentualUser);
        const pctParceiro = parseFloat(percentualParceiro);
        if (isNaN(pctUser) || isNaN(pctParceiro) || pctUser <= 0 || pctParceiro <= 0 || Math.abs(pctUser + pctParceiro - 100) > 0.01) {
          toast({ title: 'Erro', description: 'Os percentuais devem somar 100%', variant: 'destructive' });
          return;
        }

        setIsSavingWithPartner(true);
        try {
          const { data: respData, error } = await supabase.functions.invoke('criar-cliente-socio', {
            body: {
              cliente_data: {
                cliente_nome: data.cliente_nome,
                whatsapp: data.whatsapp,
                produto: data.produto,
                valor_total: data.valor_total,
                total_parcelas: data.total_parcelas,
                parcelas_pagas: data.parcelas_pagas,
                dia_vencimento: data.dia_vencimento,
                data_inicio: data.data_inicio,
                status_cliente: data.status_cliente,
                data_ultimo_pagamento: data.data_ultimo_pagamento,
                em_revisao: data.em_revisao,
                mes_referencia_revisao: data.mes_referencia_revisao,
              },
              email_socio: emailSocio.trim(),
              percentual_user: pctUser,
              percentual_parceiro: pctParceiro,
            },
          });

          if (error) throw error;
          if (respData?.error) throw new Error(respData.error);

          toast({ title: 'Cliente criado!', description: respData.message });
        } catch (err: any) {
          toast({ title: 'Erro', description: err.message || 'Erro ao criar cliente com sócio', variant: 'destructive' });
          return;
        } finally {
          setIsSavingWithPartner(false);
        }
      } else {
        // New client without partner
        await addCliente.mutateAsync(data);
      }
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isLoading = addCliente.isPending || updateCliente.isPending || isSavingWithPartner;

  const valorParsed = parseBrazilianCurrency(formData.valor_total);
  const pctUser = parseFloat(percentualUser);
  const pctParceiro = parseFloat(percentualParceiro);
  const showPreview = comSocio && !isNaN(valorParsed) && valorParsed > 0 && !isNaN(pctUser) && !isNaN(pctParceiro);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="cliente_nome">Nome do Cliente *</Label>
            <Input
              id="cliente_nome"
              value={formData.cliente_nome}
              onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
              placeholder="Nome completo"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              value={formData.whatsapp}
              onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="produto">Produto *</Label>
            {showNovoProduto ? (
              <div className="flex gap-2">
                <Input
                  id="novo_produto"
                  value={novoProduto}
                  onChange={(e) => setNovoProduto(e.target.value)}
                  placeholder="Nome do novo produto"
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    if (novoProduto.trim()) {
                      await addProduto.mutateAsync(novoProduto.trim());
                      setFormData({ ...formData, produto: novoProduto.trim() });
                      setNovoProduto('');
                      setShowNovoProduto(false);
                    }
                  }}
                  disabled={addProduto.isPending || !novoProduto.trim()}
                >
                  {addProduto.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setNovoProduto(''); setShowNovoProduto(false); }}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={formData.produto}
                  onValueChange={(value) => setFormData({ ...formData, produto: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.nome}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNovoProduto(true)}
                  title="Adicionar novo produto"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="valor_total">Valor Total (R$) *</Label>
              <Input
                id="valor_total"
                type="text"
                inputMode="numeric"
                value={formData.valor_total}
                onChange={(e) => {
                  const cents = toCents(e.target.value);
                  setFormData({ ...formData, valor_total: formatCurrencyInput(cents) });
                }}
                placeholder="0,00"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="total_parcelas">Total Parcelas *</Label>
              <Input
                id="total_parcelas"
                type="number"
                min="1"
                max="48"
                value={formData.total_parcelas}
                onChange={(e) => setFormData({ ...formData, total_parcelas: e.target.value })}
                placeholder="12"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="dia_vencimento">Dia Vencimento (1-31) *</Label>
              <Input
                id="dia_vencimento"
                type="number"
                min="1"
                max="31"
                value={formData.dia_vencimento}
                onChange={(e) => setFormData({ ...formData, dia_vencimento: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="data_inicio">Data Início *</Label>
              <Input
                id="data_inicio"
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status_cliente">Status do Cliente</Label>
            <Select
              value={formData.status_cliente}
              onValueChange={(value: StatusCliente) => setFormData({ ...formData, status_cliente: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ATIVO">Ativo</SelectItem>
                <SelectItem value="PAUSADO">Pausado</SelectItem>
                <SelectItem value="CANCELADO">Cancelado</SelectItem>
                <SelectItem value="QUITADO">Quitado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {cliente && (
            <div className="grid gap-2">
              <Label htmlFor="parcelas_pagas">Parcelas Pagas</Label>
              <Input
                id="parcelas_pagas"
                type="number"
                min="0"
                max={formData.total_parcelas}
                value={formData.parcelas_pagas}
                onChange={(e) => setFormData({ ...formData, parcelas_pagas: e.target.value })}
              />
            </div>
          )}

          {/* Partner section - only for new clients */}
          {!cliente && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="com-socio" className="flex items-center gap-2 cursor-pointer">
                  <Users className="w-4 h-4 text-primary" />
                  Adicionar sócio
                </Label>
                <Switch
                  id="com-socio"
                  checked={comSocio}
                  onCheckedChange={setComSocio}
                />
              </div>

              {comSocio && (
                <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="grid gap-2">
                    <Label htmlFor="email-socio" className="text-xs">Email do sócio</Label>
                    <Input
                      id="email-socio"
                      type="email"
                      placeholder="socio@email.com"
                      value={emailSocio}
                      onChange={(e) => setEmailSocio(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1">
                      <Label className="text-xs">Meu % </Label>
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
                      <p>Meu valor: <span className="font-medium text-foreground">R$ {(valorParsed * pctUser / 100).toFixed(2).replace('.', ',')}</span></p>
                      <p>Sócio: <span className="font-medium text-foreground">R$ {(valorParsed * pctParceiro / 100).toFixed(2).replace('.', ',')}</span></p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {cliente ? 'Salvar' : comSocio ? 'Criar com Sócio' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
