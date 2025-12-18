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
  status: 'Em dia' | 'Atrasado';
  dias_em_atraso: number;
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
  
  // Create the due date for current month
  const dataVencimentoMesAtual = new Date(anoAtual, mesAtual, cliente.dia_vencimento);
  
  // Check if there's still pending installments
  let status: 'Em dia' | 'Atrasado' = 'Em dia';
  let dias_em_atraso = 0;
  
  if (parcelas_pendentes > 0) {
    // Check if payment was made this month
    const ultimoPagamento = cliente.data_ultimo_pagamento 
      ? new Date(cliente.data_ultimo_pagamento) 
      : null;
    
    const pagouNesteMes = ultimoPagamento 
      ? ultimoPagamento.getMonth() === mesAtual && ultimoPagamento.getFullYear() === anoAtual
      : false;
    
    // If today is past due date and no payment this month
    if (hoje > dataVencimentoMesAtual && !pagouNesteMes) {
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
  };
}