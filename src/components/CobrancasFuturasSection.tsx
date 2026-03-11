import { useState } from 'react';
import { CobrancaFutura, useCobrancasFuturas } from '@/hooks/useCobrancasFuturas';
import { CobrancaFuturaModal } from './CobrancaFuturaModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, ChevronDown, ChevronRight, Send, ExternalLink, Pencil, Trash2, UserPlus, Clock } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getStatusInfo(cobranca: CobrancaFutura) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataEnvio = parseISO(cobranca.data_envio_link);

  if (cobranca.status === 'CONVERTIDO') return { label: 'Convertido', variant: 'default' as const, color: 'text-muted-foreground' };
  if (cobranca.status === 'ENVIADO') return { label: 'Link Enviado', variant: 'secondary' as const, color: 'text-primary' };

  const diff = differenceInDays(dataEnvio, hoje);
  if (diff < 0) return { label: `${Math.abs(diff)}d atrasado`, variant: 'destructive' as const, color: 'text-destructive' };
  if (diff === 0) return { label: 'Enviar hoje!', variant: 'destructive' as const, color: 'text-destructive' };
  if (diff <= 3) return { label: `${diff}d restantes`, variant: 'secondary' as const, color: 'text-amber-500' };
  return { label: `${diff}d restantes`, variant: 'outline' as const, color: 'text-muted-foreground' };
}

interface Props {
  onConvertToCliente: (cobranca: CobrancaFutura) => void;
}

export function CobrancasFuturasSection({ onConvertToCliente }: Props) {
  const { cobrancas, isLoading, updateCobranca, deleteCobranca, converterEmCliente } = useCobrancasFuturas();
  const [isOpen, setIsOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<CobrancaFutura | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const pendentes = cobrancas.filter((c) => c.status !== 'CONVERTIDO');

  const handleEdit = (c: CobrancaFutura) => {
    setSelected(c);
    setModalOpen(true);
  };

  const handleNew = () => {
    setSelected(null);
    setModalOpen(true);
  };

  const handleMarcarEnviado = (c: CobrancaFutura) => {
    updateCobranca.mutate({ id: c.id, status: 'ENVIADO' });
  };

  const handleConverter = (c: CobrancaFutura) => {
    converterEmCliente.mutate(c, {
      onSuccess: () => onConvertToCliente(c),
    });
  };

  if (isLoading) return null;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Send className="h-4 w-4 text-primary" />
              Cobranças Futuras
              {pendentes.length > 0 && (
                <Badge variant="secondary" className="ml-1">{pendentes.length}</Badge>
              )}
            </button>
          </CollapsibleTrigger>
          <Button size="sm" variant="outline" onClick={handleNew}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova
          </Button>
        </div>

        <CollapsibleContent className="mt-2">
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma cobrança futura pendente.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Valor à Vista</TableHead>
                    <TableHead>Data Envio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendentes.map((c) => {
                    const statusInfo = getStatusInfo(c);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <div>
                            {c.cliente_nome}
                            {c.whatsapp && (
                              <span className="text-xs text-muted-foreground ml-2">{c.whatsapp}</span>
                            )}
                          </div>
                          {c.observacao && (
                            <p className="text-xs text-muted-foreground mt-0.5">{c.observacao}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{c.produto || '—'}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(c.valor_a_vista)}</TableCell>
                        <TableCell className="text-sm">
                          {format(parseISO(c.data_envio_link), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant} className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {c.link_pagamento && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => window.open(c.link_pagamento!, '_blank')}
                                title="Abrir link"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {c.status === 'PENDENTE' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-primary"
                                onClick={() => handleMarcarEnviado(c)}
                                title="Marcar como enviado"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-green-600"
                              onClick={() => handleConverter(c)}
                              title="Converter em cliente recorrente"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleEdit(c)}
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteId(c.id)}
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <CobrancaFuturaModal open={modalOpen} onClose={() => setModalOpen(false)} cobranca={selected} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cobrança futura?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteCobranca.mutate(deleteId!); setDeleteId(null); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
