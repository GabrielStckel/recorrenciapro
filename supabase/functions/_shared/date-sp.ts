// Helpers de data no fuso America/Sao_Paulo.
// Usados por edge functions para evitar deriva de dia/mês entre ~21h e 00h UTC.

const TZ = 'America/Sao_Paulo'

function partsInSP(date: Date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return {
    ano: get('year'),
    mes: get('month'),
    dia: get('day'),
    hora: get('hour'),
    min: get('minute'),
    seg: get('second'),
  }
}

export function todayISOSaoPaulo(date: Date = new Date()): string {
  const { ano, mes, dia } = partsInSP(date)
  return `${ano}-${mes}-${dia}`
}

export function currentMonthSaoPaulo(date: Date = new Date()): string {
  const { ano, mes } = partsInSP(date)
  return `${ano}-${mes}`
}

// Timestamp ISO representando "agora" no fuso SP com offset -03:00.
// Útil para gravar created_at compartilhado entre contas.
export function nowISOSaoPaulo(date: Date = new Date()): string {
  const { ano, mes, dia, hora, min, seg } = partsInSP(date)
  return `${ano}-${mes}-${dia}T${hora}:${min}:${seg}-03:00`
}
