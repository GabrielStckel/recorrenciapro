import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ComoUsar() {
  return (
    <Layout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <h1 className="text-2xl font-bold">Como Usar</h1>
        
        <Card className="glass">
          <CardHeader><CardTitle>Campos Manuais vs Automáticos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Badge className="bg-primary/20 text-primary mb-2">Você preenche</Badge><p className="text-sm text-muted-foreground">Nome, WhatsApp, Produto, Valor Total, Total de Parcelas, Dia de Vencimento, Data de Início</p></div>
            <div><Badge className="bg-info/20 text-info mb-2">Calculado automaticamente</Badge><p className="text-sm text-muted-foreground">Valor da Parcela, Parcelas Pendentes, Valor Pago, Valor a Receber, Status, Dias em Atraso</p></div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Botões de Ação</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3"><Badge className="bg-success/20 text-success">+1</Badge><p className="text-sm">Registra pagamento de uma parcela e atualiza a data do último pagamento</p></div>
            <div className="flex items-start gap-3"><Badge variant="outline">-1</Badge><p className="text-sm">Remove uma parcela paga (para correções)</p></div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Dicas de Uso Diário</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Acesse o Dashboard para ver KPIs e clientes em atraso</p>
            <p>• Use os filtros na página Clientes para encontrar rapidamente</p>
            <p>• O gráfico de previsão atualiza automaticamente ao registrar pagamentos</p>
            <p>• Histórico de pagamentos fica salvo para cada cliente</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}