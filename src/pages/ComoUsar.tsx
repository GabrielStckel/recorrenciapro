import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ComoUsar() {
  return (
    <Layout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Como Usar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            O Recorrência Pro controla as vendas parceladas mês a mês (Parcelamento Inteligente, assinatura e boleto/PIX
            da Hotmart): quem pagou, quem está atrasado e quanto ainda falta receber.
          </p>
        </div>

        <Card className="glass">
          <CardHeader><CardTitle>Status de pagamento</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Badge className="bg-success/20 text-success shrink-0">Em dia</Badge>
              <p>As parcelas pagas cobrem todos os vencimentos até hoje.</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="bg-warning/20 text-warning shrink-0">Em revisão</Badge>
              <p>
                O vencimento do mês passou e nenhum pagamento foi registrado no mês. O cliente fica aqui até você confirmar
                na Hotmart e clicar <strong>Pagou</strong> ou <strong>Não pagou</strong> — ele nunca sai sozinho.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="bg-destructive/20 text-destructive shrink-0">Atrasado</Badge>
              <p>
                Você marcou <strong>Não pagou</strong> no mês, ou existem parcelas de meses anteriores sem pagamento.
                Cada parcela vencida aparece em "Parcelas em Atraso" no Dashboard.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Rotina do mês</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Abra o Dashboard: quem venceu e não tem pagamento entra em <strong className="text-foreground">Pagamentos em Revisão</strong>.</p>
            <p>2. Confira cada nome na Hotmart (Assinaturas / Parcelamento Inteligente).</p>
            <p>3. Pagou → <strong className="text-foreground">Pagou</strong>. Pagou só uma parte → botão <strong className="text-foreground">$</strong> com o valor e uma observação. Não pagou → <strong className="text-foreground">Não pagou</strong>.</p>
            <p>4. Se um pagamento atrasado entrar depois, use <strong className="text-foreground">Confirmar Pagamento</strong> em Parcelas em Atraso, ou o <strong className="text-foreground">+1</strong> na página Clientes.</p>
            <p>5. Quando o cliente pagar a última parcela, mude o status para <strong className="text-foreground">Quitado</strong>.</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Valores e Hotmart</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              O valor da parcela cadastrado é a <strong className="text-foreground">sua parte</strong>, não o preço cheio da Hotmart.
              Para conferir: <strong className="text-foreground">(preço da parcela − 8,9% − R$ 1) × seu percentual</strong>.
            </p>
            <p>Ex.: parcela de R$ 500 na Hotmart → (500 − 44,50 − 1) × 30% = R$ 136,35.</p>
            <p>
              "Recebido no mês" soma uma parcela de cada cliente cuja data do último pagamento cai no mês atual.
              Ao registrar um pagamento atrasado, a data gravada é a do registro.
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Campos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Badge className="bg-primary/20 text-primary mb-2">Você preenche</Badge><p className="text-sm text-muted-foreground">Nome, WhatsApp, Produto, Valor da Parcela, Total de Parcelas, Dia de Vencimento, Data de Início, Status do cliente</p></div>
            <div><Badge className="bg-info/20 text-info mb-2">Calculado automaticamente</Badge><p className="text-sm text-muted-foreground">Valor Total, Parcelas Pendentes, Valor Pago, Valor a Receber, Status de pagamento, Dias e Parcelas em Atraso</p></div>
            <p className="text-sm text-muted-foreground">
              A primeira parcela vence no próprio mês de início se a data de início for até o dia de vencimento; se for depois, vence no mês seguinte.
              Dia 31 em meses curtos vira o último dia do mês.
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Status do cliente</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Ativo</strong> — entra nos totais, no gráfico e nas listas de revisão/atraso.</p>
            <p><strong className="text-foreground">Pausado / Cancelado</strong> — sai dos totais e das cobranças (use Cancelado quando a assinatura foi cancelada na Hotmart).</p>
            <p><strong className="text-foreground">Quitado</strong> — todas as parcelas pagas.</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Botões de ação</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3"><Badge className="bg-success/20 text-success">+1</Badge><p className="text-sm">Registra o pagamento de uma parcela (pede o PIN, se configurado) e atualiza a data do último pagamento</p></div>
            <div className="flex items-start gap-3"><Badge variant="outline">-1</Badge><p className="text-sm">Desfaz a última parcela paga (para correções)</p></div>
            <div className="flex items-start gap-3"><Badge variant="outline">Movimentos</Badge><p className="text-sm">Mostra quem registrou cada +1/-1 e quando; a página Histórico reúne todos</p></div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Sócio</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Um cliente vinculado a um sócio existe nas duas contas, cada uma com o seu percentual do valor.
              Pagamentos, "Não pagou", edições e exclusões feitos de um lado são repetidos no outro.
            </p>
            <p>
              Para vincular um cliente que já existe: menu <strong className="text-foreground">⋯ → Vincular sócio</strong> na página Clientes.
              Para criar já com sócio: ative <strong className="text-foreground">Adicionar sócio</strong> no cadastro.
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Cobranças futuras</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Para quem pagou uma entrada e vai começar a recorrência depois: registre a data de envio do link.
              Quando a recorrência começar, use <strong className="text-foreground">Converter em cliente</strong> — o valor vem preenchido
              com o seu percentual se houver sócio.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
