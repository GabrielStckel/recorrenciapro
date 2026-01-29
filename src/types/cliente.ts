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

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  // Calcula a data de vencimento para um ano/mês, sempre ajustando dias como 31 em fevereiro.
  // Obs: aceita "mes" fora do range 0-11 (Date normaliza automaticamente).
  const getDataVencimentoNoMes = (ano: number, mes: number) => {
    const base = new Date(ano, mes, 1); // normaliza ano/mês
    const y = base.getFullYear();
    const m = base.getMonth();
    const dia = ajustarDiaVencimento(y, m, cliente.dia_vencimento);
    return new Date(y, m, dia);
  };

  // Data de vencimento do mês atual (usada na UI)
  const dataVencimentoMesAtual = getDataVencimentoNoMes(anoAtual, mesAtual);

  // Status e atraso
  let status: StatusPagamento = 'Em dia';
  let dias_em_atraso = 0;

  // Só calcula status de pagamento para clientes ATIVOS com parcelas pendentes
  if (parcelas_pendentes > 0 && cliente.status_cliente === 'ATIVO') {
    const dataInicio = parseDateOnlyISO(cliente.data_inicio);

    // Primeira data de vencimento: se o cliente começou antes/no dia de vencimento do mês,
    // o 1º vencimento é no próprio mês; se começou depois, é no mês seguinte.
    const vencimentoNoMesInicio = getDataVencimentoNoMes(dataInicio.getFullYear(), dataInicio.getMonth());
    const primeiraDataVencimento =
      dataInicio.getTime() <= vencimentoNoMesInicio.getTime()
        ? vencimentoNoMesInicio
        : getDataVencimentoNoMes(dataInicio.getFullYear(), dataInicio.getMonth() + 1);

    // Quantas parcelas já deveriam ter vencido até HOJE (baseado no calendário),
    // independente do campo data_ultimo_pagamento.
    let parcelasQueDeveriamEstarPagas = 0;

    if (hoje.getTime() >= primeiraDataVencimento.getTime()) {
      const diffMeses =
        (hoje.getFullYear() * 12 + hoje.getMonth()) -
        (primeiraDataVencimento.getFullYear() * 12 + primeiraDataVencimento.getMonth());

      const incluiMesAtual = hoje.getTime() >= dataVencimentoMesAtual.getTime();
      parcelasQueDeveriamEstarPagas = diffMeses + (incluiMesAtual ? 1 : 0);
    }

    parcelasQueDeveriamEstarPagas = Math.max(
      0,
      Math.min(cliente.total_parcelas, parcelasQueDeveriamEstarPagas)
    );

    const estaAtrasado = cliente.parcelas_pagas < parcelasQueDeveriamEstarPagas;

    // Verifica se foi marcado como "não pagou" neste mês (mes_referencia_revisao = mês atual e em_revisao = false)
    const mesAtualStr = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;
    const foiMarcadoNaoPagouEsteMes = 
      cliente.mes_referencia_revisao === mesAtualStr && 
      !cliente.em_revisao;

    // Verifica se realmente pagou neste mês
    let pagouEsteMes = false;
    if (cliente.data_ultimo_pagamento) {
      const ultimoPagamento = parseDateOnlyISO(cliente.data_ultimo_pagamento);
      pagouEsteMes = ultimoPagamento.getMonth() === mesAtual && ultimoPagamento.getFullYear() === anoAtual;
    }

    // Cliente está atrasado se:
    // 1. Parcelas pagas < parcelas que deveriam estar pagas, OU
    // 2. Foi marcado como "não pagou" este mês E não tem pagamento registrado este mês
    const deveSerAtrasado = estaAtrasado || (foiMarcadoNaoPagouEsteMes && !pagouEsteMes);

    // Calcular dias em atraso sempre que estiver atrasado
    if (deveSerAtrasado) {
      dias_em_atraso = Math.max(
        0,
        Math.floor((hoje.getTime() - dataVencimentoMesAtual.getTime()) / (1000 * 60 * 60 * 24))
      );
    }

    // Prioridade: em revisão
    if (cliente.em_revisao) {
      status = 'Em revisão';
    } else if (deveSerAtrasado) {
      status = 'Atrasado';
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
