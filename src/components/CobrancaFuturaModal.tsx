import { useState, useEffect } from 'react';
import { CobrancaFutura, CobrancaFuturaInsert, useCobrancasFuturas } from '@/hooks/useCobrancasFuturas';
import { useProdutos } from '@/hooks/useProdutos';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

function formatCurrencyInput(value: string): string {
  const numbers = value.replace(/\D/g, '');
  const amount = parseInt(numbers || '0', 10) / 100;
  return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBrazilianCurrency(value: string): number {
  if (!value) return 0;
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

interface Props {
  open: boolean;
  onClose: () => void;
  cobranca: CobrancaFutura | null;
}

export function CobrancaFuturaModal({ open, onClose, cobranca }: Props) {
  const { addCobranca, updateCobranca } = useCobrancasFuturas();
  const { produtos } = useProdutos();
  const isEditing = !!cobranca;

  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [valorDisplay, setValorDisplay] = useState('');
  const [dataEnvio, setDataEnvio] = useState('');
  const [link, setLink] = useState('');
  const [produto, setProduto] = useState('');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (open) {
      if (cobranca) {
        setNome(cobranca.cliente_nome);
        setWhatsapp(cobranca.whatsapp || '');
        setValorDisplay(cobranca.valor_a_vista.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        setDataEnvio(cobranca.data_envio_link);
        setLink(cobranca.link_pagamento || '');
        setProduto(cobranca.produto || '');
        setObservacao(cobranca.observacao || '');
      } else {
        setNome(''); setWhatsapp(''); setValorDisplay(''); setDataEnvio('');
        setLink(''); setProduto(''); setObservacao('');
      }
    }
  }, [open, cobranca]);

  const loading = addCobranca.isPending || updateCobranca.isPending;

  const handleSubmit = () => {
    if (!nome || !dataEnvio) return;
    const payload = {
      cliente_nome: nome,
      whatsapp: whatsapp || null,
      valor_a_vista: parseBrazilianCurrency(valorDisplay),
      data_envio_link: dataEnvio,
      link_pagamento: link || null,
      produto: produto || null,
      observacao: observacao || null,
    };

    if (isEditing) {
      updateCobranca.mutate({ id: cobranca!.id, ...payload }, { onSuccess: onClose });
    } else {
      addCobranca.mutate(payload as CobrancaFuturaInsert, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
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
          <div>
            <Label>Valor Pago à Vista (R$)</Label>
            <Input
              value={valorDisplay}
              onChange={(e) => setValorDisplay(formatCurrencyInput(e.target.value))}
              placeholder="0,00"
            />
          </div>
          <div>
            <Label>Produto</Label>
            <Select value={produto} onValueChange={setProduto}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {produtos.map((p) => (
                  <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
