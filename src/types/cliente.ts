export type StatusCliente = 'ATIVO' | 'PAUSADO' | 'CANCELADO' | 'QUITADO';

export type StatusPagamento = 'Em dia' | 'Em revisão' | 'Atrasado';

export interface Cliente {
  id: string;
  user_id: string;
  cliente_nome: string;
  whatsapp: string | null;
  produto: string;
  valor_total: number;
  total_parcelas: number;
  parcelas_pagas: number;
  data_inicio: string;
  data_ultimo_pagamento: string | null;
  dia_vencimento: number;
  status_cliente: StatusCliente;
  em_revisao: boolean;
  mes_referencia_revisao: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoricoPagamento {
  id: string;
  cliente_id: string;
  data_pagamento: string;
  valor_pago: number;
  numero_parcela: number;
  registrado_por: string | null;
  created_at: string;
}

export interface ClienteCalculado extends Cliente {
  valor_parcela: number;
  parcelas_pendentes: number;
  valor_pago: number;
  valor_a_receber: number;
  status: StatusPagamento;
  dias_em_atraso: number;
  data_vencimento_mes_atual: Date;
}

// Função auxiliar para obter o último dia do mês
function getUltimoDiaDoMes(ano: number, mes: number): number {
  // mes é 0-indexed (0 = janeiro), então passamos mes+1 e dia 0 para pegar o último dia do mês anterior
  return new Date(ano, mes + 1, 0).getDate();
}

// Função para ajustar o dia de vencimento ao mês (ex: dia 31 em fevereiro -> 28/29)
function ajustarDiaVencimento(ano: number, mes: number, diaVencimento: number): number {
  const ultimoDia = getUltimoDiaDoMes(ano, mes);
  return Math.min(diaVencimento, ultimoDia);
}

// Parse seguro de datas "YYYY-MM-DD" como data local (evita problemas de timezone)
function parseDateOnlyISO(dateStr: string): Date {
  const [ano, mes, dia] = dateStr.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

export function calcularDadosCliente(cliente: Cliente): ClienteCalculado {
  const valor_parcela = cliente.valor_total / cliente.total_parcelas;
  const parcelas_pendentes = cliente.total_parcelas - cliente.parcelas_pagas;
  const valor_pago = valor_parcela * cliente.parcelas_pagas;
  const valor_a_receber = cliente.valor_total - valor_pago;

  // Calculate status and days overdue
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  // Ajustar dia de vencimento para o mês atual (ex: dia 31 em fevereiro -> 28/29)
  const diaVencimentoAjustado = ajustarDiaVencimento(anoAtual, mesAtual, cliente.dia_vencimento);

  // Create the due date for current month with adjusted day
  const dataVencimentoMesAtual = new Date(anoAtual, mesAtual, diaVencimentoAjustado);

  // Check if there's still pending installments
  let status: StatusPagamento = 'Em dia';
  let dias_em_atraso = 0;

  // Only calculate for ATIVO clients with pending parcels
  if (parcelas_pendentes > 0 && cliente.status_cliente === 'ATIVO') {
    // Check if payment was made this month
    const ultimoPagamento = cliente.data_ultimo_pagamento
      ? parseDateOnlyISO(cliente.data_ultimo_pagamento)
      : null;

    const pagouNesteMes = ultimoPagamento
      ? ultimoPagamento.getMonth() === mesAtual && ultimoPagamento.getFullYear() === anoAtual
      : false;

    // Priority: em_revisao = true => "Em revisão"
    if (cliente.em_revisao) {
      status = 'Em revisão';
      // Still calculate days for reference
      if (hoje.getTime() >= dataVencimentoMesAtual.getTime()) {
        dias_em_atraso = Math.floor((hoje.getTime() - dataVencimentoMesAtual.getTime()) / (1000 * 60 * 60 * 24));
      }
    } else if (hoje.getTime() >= dataVencimentoMesAtual.getTime() && !pagouNesteMes) {
      // If today is on/after due date and no payment this month => Atrasado
      status = 'Atrasado';
      dias_em_atraso = Math.floor((hoje.getTime() - dataVencimentoMesAtual.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  return {
    ...cliente,
    valor_parcela,
    parcelas_pendentes,
    valor_pago,
    valor_a_receber,
    status,
    dias_em_atraso,
    data_vencimento_mes_atual: dataVencimentoMesAtual,
  };
}