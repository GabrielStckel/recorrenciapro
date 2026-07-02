export type StatusCliente = 'ATIVO' | 'PAUSADO' | 'CANCELADO' | 'QUITADO';

export type StatusPagamento = 'Em dia' | 'Em revisão' | 'Atrasado';

export interface Cliente {
  id: string;
  user_id: string;
  cliente_nome: string;
  whatsapp: string | null;
  produto: string;
  valor_total: number;
  valor_parcela: number | null;
  total_parcelas: number;
  parcelas_pagas: number;
  data_inicio: string;
  data_ultimo_pagamento: string | null;
  dia_vencimento: number;
  status_cliente: StatusCliente;
  em_revisao: boolean;
  mes_referencia_revisao: string | null;
  valor_pago_parcial: number | null;
  observacao_revisao: string | null;
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
  parcelas_atrasadas: number;
  primeira_data_vencimento: Date | null;
  data_vencimento_mes_atual: Date;
  em_revisao_efetivo: boolean;
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
  const valor_parcela = cliente.valor_parcela != null
    ? Number(cliente.valor_parcela)
    : (cliente.total_parcelas > 0 ? cliente.valor_total / cliente.total_parcelas : 0);
  const valor_total_efetivo = valor_parcela * cliente.total_parcelas;
  const parcelas_pendentes = cliente.total_parcelas - cliente.parcelas_pagas;
  const valor_pago = valor_parcela * cliente.parcelas_pagas;
  const valor_a_receber = valor_total_efetivo - valor_pago;

  const agora = new Date();
  // "hoje" sem horário para comparar com vencimentos (que são meia-noite local)
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
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
  let parcelas_atrasadas = 0;
  let primeira_data_vencimento: Date | null = null;

  // Só calcula status de pagamento para clientes ATIVOS com parcelas pendentes
  if (parcelas_pendentes > 0 && cliente.status_cliente === 'ATIVO') {
    const dataInicio = parseDateOnlyISO(cliente.data_inicio);

    // Primeira data de vencimento: se o cliente começou antes/no dia de vencimento do mês,
    // o 1º vencimento é no próprio mês; se começou depois, é no mês seguinte.
    const vencimentoNoMesInicio = getDataVencimentoNoMes(dataInicio.getFullYear(), dataInicio.getMonth());
    const primeiraDataVencimentoCalc =
      dataInicio.getTime() <= vencimentoNoMesInicio.getTime()
        ? vencimentoNoMesInicio
        : getDataVencimentoNoMes(dataInicio.getFullYear(), dataInicio.getMonth() + 1);
    
    primeira_data_vencimento = primeiraDataVencimentoCalc;

    // Quantas parcelas já deveriam ter vencido até HOJE (baseado no calendário),
    // independente do campo data_ultimo_pagamento.
    let parcelasQueDeveriamEstarPagas = 0;

    if (hoje.getTime() > primeiraDataVencimentoCalc.getTime()) {
      const diffMeses =
        (hoje.getFullYear() * 12 + hoje.getMonth()) -
        (primeiraDataVencimentoCalc.getFullYear() * 12 + primeiraDataVencimentoCalc.getMonth());

      const incluiMesAtual = hoje.getTime() > dataVencimentoMesAtual.getTime();
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

    // "Não pagou" só é válido se o vencimento deste mês já passou
    // (se o vencimento foi alterado para o futuro, o flag anterior não se aplica)
    const vencimentoMesAtualJaPassou = hoje.getTime() > dataVencimentoMesAtual.getTime();
    const foiMarcadoNaoPagouValido = foiMarcadoNaoPagouEsteMes && vencimentoMesAtualJaPassou;

    // Cliente está atrasado se:
    // 1. Parcelas pagas < parcelas que deveriam estar pagas, OU
    // 2. Foi marcado como "não pagou" este mês E vencimento já passou E não pagou
    const deveSerAtrasado = estaAtrasado || (foiMarcadoNaoPagouValido && !pagouEsteMes);

    // Calcular parcelas atrasadas e dias em atraso
    if (deveSerAtrasado) {
      parcelas_atrasadas = Math.max(0, parcelasQueDeveriamEstarPagas - cliente.parcelas_pagas);
      // Se foi marcado como não pagou mas matematicamente não está atrasado, conta como 1
      if (parcelas_atrasadas === 0 && foiMarcadoNaoPagouValido && !pagouEsteMes) {
        parcelas_atrasadas = 1;
      }

      // Dias em atraso: calculado a partir da parcela mais antiga não paga
      const parcelaAtrasada = cliente.parcelas_pagas + 1;
      const mesesAposInicio = parcelaAtrasada - 1;
      const dataVencimentoAtrasada = getDataVencimentoNoMes(
        primeiraDataVencimentoCalc.getFullYear(),
        primeiraDataVencimentoCalc.getMonth() + mesesAposInicio
      );
      
      dias_em_atraso = Math.max(
        0,
        Math.floor((hoje.getTime() - dataVencimentoAtrasada.getTime()) / (1000 * 60 * 60 * 24))
      );
    }

    // Revisão e atraso são estados mutuamente exclusivos na exibição.
    // Se o cliente está em_revisao, o status é sempre 'Em revisão' — a saída
    // só ocorre pelos botões "Pagou" / "Não pagou".
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
    parcelas_atrasadas,
    primeira_data_vencimento: primeira_data_vencimento,
    data_vencimento_mes_atual: dataVencimentoMesAtual,
  };
}

// Helper: gera lista expandida de parcelas atrasadas para exibição
export interface ParcelaAtrasada {
  cliente: ClienteCalculado;
  numeroParcela: number;
  dataVencimento: Date;
  diasAtraso: number;
}

export function expandirParcelasAtrasadas(clientes: ClienteCalculado[]): ParcelaAtrasada[] {
  const hoje = new Date();
  const resultado: ParcelaAtrasada[] = [];

  const getDataVencimentoNoMes = (ano: number, mes: number, diaVencimento: number) => {
    const base = new Date(ano, mes, 1);
    const y = base.getFullYear();
    const m = base.getMonth();
    const dia = Math.min(diaVencimento, new Date(y, m + 1, 0).getDate());
    return new Date(y, m, dia);
  };

  for (const cliente of clientes) {
    // Include clients with overdue parcels regardless of review status
    if (cliente.em_revisao) continue;
    if (cliente.parcelas_atrasadas <= 0 || !cliente.primeira_data_vencimento || cliente.status_cliente !== 'ATIVO') continue;

    for (let i = 0; i < cliente.parcelas_atrasadas; i++) {
      const numeroParcela = cliente.parcelas_pagas + 1 + i;
      const mesesAposInicio = numeroParcela - 1;
      const dataVencimento = getDataVencimentoNoMes(
        cliente.primeira_data_vencimento.getFullYear(),
        cliente.primeira_data_vencimento.getMonth() + mesesAposInicio,
        cliente.dia_vencimento
      );
      const diasAtraso = Math.max(
        0,
        Math.floor((hoje.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24))
      );

      resultado.push({
        cliente,
        numeroParcela,
        dataVencimento,
        diasAtraso,
      });
    }
  }

  // Ordenar por dias de atraso (mais atrasado primeiro)
  resultado.sort((a, b) => b.diasAtraso - a.diasAtraso);
  return resultado;
}
