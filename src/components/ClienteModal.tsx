import { useState, useEffect } from 'react';
import { ClienteCalculado } from '@/types/cliente';
import { useClientes } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

const clienteSchema = z.object({
  cliente_nome: z.string().min(1, 'Nome é obrigatório').max(100),
  whatsapp: z.string().max(20).optional(),
  produto: z.string().min(1, 'Produto é obrigatório').max(100),
  valor_total: z.number().positive('Valor deve ser positivo'),
  total_parcelas: z.number().int().positive('Parcelas devem ser positivas').max(48),
  dia_vencimento: z.number().int().min(1).max(28, 'Dia deve ser entre 1 e 28'),
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
    data_inicio: new Date().toISOString().split('T')[0],
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
        data_inicio: new Date().toISOString().split('T')[0],
      });
    }
  }, [cliente, open]);

  const handleSubmit = async () => {
    try {
      const data = {
        cliente_nome: formData.cliente_nome.trim(),
        whatsapp: formData.whatsapp.trim() || null,
        produto: formData.produto.trim(),
        valor_total: parseFloat(formData.valor_total),
        total_parcelas: parseInt(formData.total_parcelas),
        parcelas_pagas: parseInt(formData.parcelas_pagas),
        dia_vencimento: parseInt(formData.dia_vencimento),
        data_inicio: formData.data_inicio,
        data_ultimo_pagamento: null,
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
                type="number"
                step="0.01"
                value={formData.valor_total}
                onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
                placeholder="0.00"
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
              <Label htmlFor="dia_vencimento">Dia Vencimento (1-28) *</Label>
              <Input
                id="dia_vencimento"
                type="number"
                min="1"
                max="28"
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