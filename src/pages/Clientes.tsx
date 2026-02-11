import { useState } from 'react';
import { useClientes } from '@/hooks/useClientes';
import { useHideValues } from '@/hooks/useHideValues';
import { Layout } from '@/components/Layout';
import { ClientesTable } from '@/components/ClientesTable';
import { ClienteModal } from '@/components/ClienteModal';
import { HistoricoModal } from '@/components/HistoricoModal';
import { MovimentosModal } from '@/components/MovimentosModal';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Eye, EyeOff } from 'lucide-react';
import { ClienteCalculado } from '@/types/cliente';

export default function Clientes() {
  const { clientes, isLoading } = useClientes();
  const { hideValues, toggleHideValues } = useHideValues();
  const [modalOpen, setModalOpen] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [movimentosOpen, setMovimentosOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<ClienteCalculado | null>(null);

  const handleEdit = (cliente: ClienteCalculado) => {
    setSelectedCliente(cliente);
    setModalOpen(true);
  };

  const handleHistory = (cliente: ClienteCalculado) => {
    setSelectedCliente(cliente);
    setHistoricoOpen(true);
  };

  const handleMovimentos = (cliente: ClienteCalculado) => {
    setSelectedCliente(cliente);
    setMovimentosOpen(true);
  };

  if (isLoading) {
    return <Layout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Clientes</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleHideValues}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            >
              {hideValues ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
            <Button onClick={() => { setSelectedCliente(null); setModalOpen(true); }}><Plus className="w-4 h-4 mr-2" />Novo Cliente</Button>
          </div>
        </div>
        <ClientesTable clientes={clientes} onEdit={handleEdit} onHistory={handleHistory} onMovimentos={handleMovimentos} hideValues={hideValues} />
        <ClienteModal open={modalOpen} onClose={() => setModalOpen(false)} cliente={selectedCliente} />
        <HistoricoModal open={historicoOpen} onClose={() => setHistoricoOpen(false)} cliente={selectedCliente} />
        <MovimentosModal open={movimentosOpen} onOpenChange={setMovimentosOpen} cliente={selectedCliente} />
      </div>
    </Layout>
  );
}