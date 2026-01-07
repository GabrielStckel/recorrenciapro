import { useState, useEffect } from 'react';
import { ClienteCalculado, StatusCliente } from '@/types/cliente';
import { useClientes } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

// Função para converter valor brasileiro para número
function parseBrazilianCurrency(value: string): number {
  if (!value || typeof value !== 'string') return NaN;
  
  // Remove R$, espaços, pontos de milhar
  let cleaned = value
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')  // Remove pontos de milhar
    .replace(',', '.');   // Troca vírgula por ponto decimal
  
  return parseFloat(cleaned);
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
}

export function ClienteModal({ open, onClose, cliente }: ClienteModalProps) {
  const { addCliente, updateCliente } = useClientes();
  const { toast } = useToast();
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
        valor_total: cliente.valor_total.toString(),
        total_parcelas: cliente.total_parcelas.toString(),
        parcelas_pagas: cliente.parcelas_pagas.toString(),
        dia_vencimento: cliente.dia_vencimento.toString(),
        data_inicio: cliente.data_inicio,
        status_cliente: cliente.status_cliente || 'ATIVO',
      });
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
    }
  }, [cliente, open]);

  const handleSubmit = async () => {
    try {
      // Parse valor_total com formato brasileiro
      const valorParsed = parseBrazilianCurrency(formData.valor_total);
      
      if (isNaN(valorParsed)) {
        toast({
          title: 'Erro de validação',
          description: 'Digite um valor válido, ex: 1636,20',
          variant: 'destructive',
        });
        return;
      }

      const totalParcelasParsed = parseInt(formData.total_parcelas, 10);
      const parcelasPagasParsed = parseInt(formData.parcelas_pagas, 10);
      const diaVencimentoParsed = parseInt(formData.dia_vencimento, 10);

      if (!Number.isInteger(totalParcelasParsed) || totalParcelasParsed <= 0) {
        toast({
          title: 'Erro de validação',
          description: 'Total de parcelas deve ser um número inteiro maior que zero.',
          variant: 'destructive',
        });
        return;
      }

      if (!Number.isInteger(parcelasPagasParsed) || parcelasPagasParsed < 0) {
        toast({
          title: 'Erro de validação',
          description: 'Parcelas pagas deve ser um número inteiro maior ou igual a zero.',
          variant: 'destructive',
        });
        return;
      }

      if (!Number.isInteger(diaVencimentoParsed) || diaVencimentoParsed < 1 || diaVencimentoParsed > 31) {
        toast({
          title: 'Erro de validação',
          description: 'Dia de vencimento deve estar entre 1 e 31.',
          variant: 'destructive',
        });
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

      // Mantém campos automáticos ao editar; define defaults ao criar
      const data = {
        ...baseData,
        data_ultimo_pagamento: cliente ? cliente.data_ultimo_pagamento : null,
        em_revisao: cliente ? cliente.em_revisao : false,
        mes_referencia_revisao: cliente ? cliente.mes_referencia_revisao : null,
      };

      const result = clienteSchema.safeParse(data);
      if (!result.success) {
        toast({
          title: 'Erro de validação',
          description: result.error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }

      if (cliente) {
        await updateCliente.mutateAsync({ id: cliente.id, ...data });
        toast({ title: 'Cliente atualizado com sucesso!' });
      } else {
        await addCliente.mutateAsync(data);
      }
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isLoading = addCliente.isPending || updateCliente.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
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
            <Input
              id="produto"
              value={formData.produto}
              onChange={(e) => setFormData({ ...formData, produto: e.target.value })}
              placeholder="Nome do produto"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="valor_total">Valor Total (R$) *</Label>
              <Input
                id="valor_total"
                type="text"
                value={formData.valor_total}
                onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
                placeholder="1636,20"
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {cliente ? 'Salvar' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}