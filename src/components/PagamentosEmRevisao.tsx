import { useState } from 'react';
import { ClienteCalculado } from '@/types/cliente';
import { useClientes } from '@/hooks/useClientes';
import { useUserSettings } from '@/hooks/useUserSettings';
import { PinDialog } from '@/components/PinDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Clock, CheckCircle, XCircle, Loader2, MessageSquare, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PagamentosEmRevisaoProps {
  clientes: ClienteCalculado[];
}

export function PagamentosEmRevisao({ clientes }: PagamentosEmRevisaoProps) {
  const { confirmarPagamentoRevisao, marcarComoAtrasado, registrarPagamentoParcial } = useClientes();
  const { hasPin, verifyPin } = useUserSettings();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pendingClienteId, setPendingClienteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [valorParcial, setValorParcial] = useState('');
  const [observacao, setObservacao] = useState('');
  
  const emRevisao = clientes.filter((c) => c.em_revisao && c.status_cliente === 'ATIVO');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleConfirmar = (clienteId: string) => {
    if (hasPin) {
      setPendingClienteId(clienteId);
      setPinError('');
      setPinDialogOpen(true);
    } else {
      confirmarPagamentoRevisao.mutate({ clienteId });
    }
  };

  const handlePinConfirm = (pin: string) => {
    if (verifyPin(pin)) {
      setPinDialogOpen(false);
      if (pendingClienteId) {
        confirmarPagamentoRevisao.mutate({ clienteId: pendingClienteId });
        setPendingClienteId(null);
      }
    } else {
      setPinError('PIN incorreto');
    }
  };

  const handleNaoPagou = (clienteId: string) => {
    marcarComoAtrasado.mutate({ clienteId });
  };

  const handleParcial = (clienteId: string) => {
    if (expandedId === clienteId) {
      setExpandedId(null);
      setValorParcial('');
      setObservacao('');
    } else {
      setExpandedId(clienteId);
      // Pre-fill with existing partial data
      const cliente = emRevisao.find(c => c.id === clienteId);
      setValorParcial(cliente?.valor_pago_parcial ? String(cliente.valor_pago_parcial) : '');
      setObservacao(cliente?.observacao_revisao || '');
    }
  };

  const handleSalvarParcial = (clienteId: string, valorParcela: number) => {
    const valor = parseFloat(valorParcial);
    if (isNaN(valor) || valor <= 0) return;

    registrarPagamentoParcial.mutate({
      clienteId,
      valorPagoParcial: valor,
      observacao: observacao.trim() || null,
    });
    setExpandedId(null);
    setValorParcial('');
    setObservacao('');
  };

  if (emRevisao.length === 0) {
    return null;
  }

  return (
    <>
    <Card className="glass border-warning/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-warning">
          <Clock className="w-4 h-4" />
          Pagamentos em Revisão
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {emRevisao.length} {emRevisao.length === 1 ? 'cliente' : 'clientes'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {emRevisao.map((cliente) => {
            const isExpanded = expandedId === cliente.id;
            const temParcial = cliente.valor_pago_parcial != null && cliente.valor_pago_parcial > 0;
            const faltaPagar = temParcial ? cliente.valor_parcela - cliente.valor_pago_parcial! : null;

            return (
              <div
                key={cliente.id}
                className="group p-2.5 rounded-lg bg-warning/10 border border-warning/20 hover:border-warning/40 hover:bg-warning/15 transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{cliente.cliente_nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{cliente.produto}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-warning">
                      Venc. {format(cliente.data_vencimento_mes_atual, 'dd/MM', { locale: ptBR })}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(cliente.valor_parcela)}
                    </p>
                  </div>
                </div>

                {/* Partial payment info */}
                {temParcial && !isExpanded && (
                  <div className="mb-2 p-1.5 rounded bg-primary/10 border border-primary/20">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-primary flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Pagou {formatCurrency(cliente.valor_pago_parcial!)}
                      </span>
                      <span className="text-destructive font-medium">
                        Falta {formatCurrency(faltaPagar!)}
                      </span>
                    </div>
                    {cliente.observacao_revisao && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-start gap-1">
                        <MessageSquare className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                        <span className="truncate">{cliente.observacao_revisao}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Expanded partial payment form */}
                {isExpanded && (
                  <div className="mb-2 p-2 rounded bg-muted/50 border border-border space-y-2">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">Valor pago (R$)</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={cliente.valor_parcela}
                        placeholder="0,00"
                        value={valorParcial}
                        onChange={(e) => setValorParcial(e.target.value)}
                        className="h-7 text-xs mt-0.5"
                      />
                      {valorParcial && !isNaN(parseFloat(valorParcial)) && parseFloat(valorParcial) > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Falta: {formatCurrency(Math.max(0, cliente.valor_parcela - parseFloat(valorParcial)))}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground">Observação</label>
                      <Textarea
                        placeholder="Ex: Pagou metade, restante dia 15"
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                        className="min-h-[40px] text-xs mt-0.5 resize-none"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="flex-1 h-6 text-[10px]"
                        onClick={() => handleSalvarParcial(cliente.id, cliente.valor_parcela)}
                        disabled={!valorParcial || isNaN(parseFloat(valorParcial)) || parseFloat(valorParcial) <= 0 || registrarPagamentoParcial.isPending}
                      >
                        {registrarPagamentoParcial.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px]"
                        onClick={() => { setExpandedId(null); setValorParcial(''); setObservacao(''); }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs bg-success/10 text-success border border-success/20 hover:bg-success hover:text-success-foreground transition-colors px-2"
                    onClick={() => handleConfirmar(cliente.id)}
                    disabled={confirmarPagamentoRevisao.isPending}
                  >
                    {confirmarPagamentoRevisao.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        <span>Pagou</span>
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground transition-colors px-2"
                    onClick={() => handleParcial(cliente.id)}
                    title="Registrar pagamento parcial"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-destructive-foreground transition-colors px-2"
                    onClick={() => handleNaoPagou(cliente.id)}
                    disabled={marcarComoAtrasado.isPending}
                  >
                    {marcarComoAtrasado.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        <span>Não pagou</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>

      <PinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        onConfirm={handlePinConfirm}
        title="Confirmar Pagamento"
        description="Digite seu PIN para confirmar o pagamento"
        error={pinError}
      />
    </>
  );
}
