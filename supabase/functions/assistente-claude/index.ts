// Assistente do Recorrência Pro: responde perguntas sobre os clientes usando a API do Claude.
//
// O front-end manda a pergunta, o histórico curto da conversa e a tabela de clientes já calculada
// (a mesma que aparece nas telas). A função confere quem está logado, chama a API da Anthropic com a
// chave guardada no servidor e devolve o texto e, quando fizer sentido, uma tabela.
//
// Segredos (Lovable Cloud → Secrets):
//   ANTHROPIC_API_KEY   chave da API da Anthropic (obrigatória)
//   ASSISTENTE_EMAILS   e-mails que podem usar o assistente, separados por vírgula (obrigatória).
//                       Qualquer pessoa pode criar conta no app; sem essa lista, qualquer conta
//                       gastaria os créditos da sua chave.
//   ANTHROPIC_MODEL     opcional, padrão claude-sonnet-5-5

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { todayISOSaoPaulo } from '../_shared/date-sp.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const MAX_MENSAGENS = 12
const MAX_CARACTERES_MENSAGEM = 4000
const MAX_CARACTERES_DADOS = 120_000

type Mensagem = { role: 'user' | 'assistant'; content: string }

const FERRAMENTA_RESPOSTA = {
  name: 'responder',
  description: 'Entrega a resposta ao usuário do Recorrência Pro. Sempre use esta ferramenta para responder.',
  input_schema: {
    type: 'object',
    properties: {
      resposta: {
        type: 'string',
        description: 'Resposta em português do Brasil, texto simples (sem markdown, sem travessão). Pode usar linhas começando com "- " para listas curtas.',
      },
      tabela: {
        type: 'object',
        description: 'Inclua quando o usuário pedir lista, tabela, relatório ou planilha, ou quando a resposta tiver vários clientes com valores. Omita para respostas simples.',
        properties: {
          titulo: { type: 'string', description: 'Título curto, vira o nome da planilha.' },
          colunas: { type: 'array', items: { type: 'string' } },
          formatos: {
            type: 'array',
            description: 'Um por coluna: texto, moeda, numero ou data.',
            items: { type: 'string', enum: ['texto', 'moeda', 'numero', 'data'] },
          },
          linhas: {
            type: 'array',
            description: 'Uma lista por linha, na ordem das colunas. Valores em moeda e números vão como número (500.5), não como texto. Datas como dd/mm/aaaa.',
            items: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] } },
          },
          totais: {
            type: 'array',
            description: 'Índices (a partir de 0) das colunas numéricas que devem ter soma no fim.',
            items: { type: 'integer' },
          },
        },
        required: ['titulo', 'colunas', 'linhas'],
      },
    },
    required: ['resposta'],
  },
}

function instrucoes(hoje: string, percentual: number) {
  const socio = 100 - percentual
  return `Você é o Claude, assistente dentro do Recorrência Pro, o sistema onde o usuário controla vendas parceladas de infoprodutos (Hotmart e Asaas) que ele divide com um sócio.

Hoje é ${hoje} (fuso de São Paulo).

Como os valores funcionam:
- Cada cliente no sistema guarda só a parte do usuário (${percentual}%) de cada parcela, já sem taxas.
- Hotmart: parte = (preço da parcela − 8,9% − R$ 1) × ${percentual}%. Asaas: parte = (preço − R$ 2,98) × ${percentual}%.
- Nos dados você já recebe o preço cheio estimado da parcela, as parcelas vencidas em aberto, o valor cheio em aberto, as taxas, o líquido, a parte do usuário (${percentual}%) e a do sócio (${socio}%).
- "Quanto fulano deve" = valor cheio em aberto (o que o cliente paga). Mostre também a parte do usuário e a do sócio quando ajudar.
- "Saldo restante" = valor cheio de todas as parcelas que faltam, vencidas ou não.
- Situação: Atrasado (tem parcela vencida sem pagar), Em revisão (venceu este mês e ninguém marcou se pagou), Em dia, Quitado, Cancelado, Pausado. Em revisão também conta como dívida vencida.
- Contrato encerrado = todas as parcelas já venceram; o que falta está todo atrasado.

Regras:
- Responda só com base nos dados abaixo. Se faltar informação, diga o que falta. Não invente clientes nem valores.
- Nomes podem vir escritos de outro jeito (ex.: "Bianca Almeida" pode ser "Bianca Olmedo Lima"). Se houver um único nome parecido, use e avise; se houver mais de um, pergunte.
- Valores em reais no formato brasileiro (R$ 1.234,56) dentro do texto. Na tabela, números como número.
- Seja direto e curto. Não use travessão (—). Não use markdown (nada de **, #, tabelas em texto).
- Quando pedirem planilha, lista ou relatório, preencha "tabela": a tela mostra a tabela e um botão para baixar em Excel. Na resposta, não repita a tabela linha por linha; diga o total e o que chama atenção.
- Você só lê os dados. Não consegue registrar pagamento, editar cliente nem criar cobrança: se pedirem, explique onde fazer isso no sistema (botões +1, Pagou/Não pagou, Editar cliente na tela Clientes).
- Sempre responda chamando a ferramenta "responder".`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ erro: 'Não autenticado' }, 401)

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) return json({ erro: 'Não autenticado' }, 401)

    const permitidos = (Deno.env.get('ASSISTENTE_EMAILS') ?? '')
      .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    if (permitidos.length === 0) {
      return json({ erro: 'O assistente ainda não foi liberado: falta cadastrar o segredo ASSISTENTE_EMAILS no Lovable Cloud.', codigo: 'sem_lista' }, 503)
    }
    if (!permitidos.includes((user.email ?? '').toLowerCase())) {
      return json({ erro: 'Sua conta não está liberada para usar o assistente.', codigo: 'nao_liberado' }, 403)
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return json({ erro: 'Falta cadastrar a chave ANTHROPIC_API_KEY no Lovable Cloud.', codigo: 'sem_chave' }, 503)
    }

    const body = await req.json()
    const percentual = Math.min(99, Math.max(1, Number(body?.percentual) || 30))
    const dados = typeof body?.dados === 'string' ? body.dados.slice(0, MAX_CARACTERES_DADOS) : ''
    const mensagens: Mensagem[] = (Array.isArray(body?.mensagens) ? body.mensagens : [])
      .filter((m: Mensagem) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string' && m.content.trim())
      .slice(-MAX_MENSAGENS)
      .map((m: Mensagem) => ({ role: m.role, content: m.content.slice(0, MAX_CARACTERES_MENSAGEM) }))

    // A conversa precisa começar com o usuário e terminar com uma pergunta dele.
    while (mensagens.length && mensagens[0].role !== 'user') mensagens.shift()
    if (!mensagens.length || mensagens[mensagens.length - 1].role !== 'user') {
      return json({ erro: 'Mande uma pergunta.' }, 400)
    }

    const resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5-5',
        max_tokens: 8000,
        system: [
          { type: 'text', text: instrucoes(todayISOSaoPaulo(), percentual) },
          // Os dados se repetem a cada pergunta da mesma conversa: o cache barateia as seguintes.
          { type: 'text', text: `Dados dos clientes (uma linha por cliente, colunas separadas por tabulação):\n${dados || '(nenhum cliente)'}`, cache_control: { type: 'ephemeral' } },
        ],
        tools: [FERRAMENTA_RESPOSTA],
        tool_choice: { type: 'tool', name: 'responder' },
        messages: mensagens,
      }),
    })

    const resultado = await resposta.json()
    if (!resposta.ok) {
      console.log('Erro da API da Anthropic:', resposta.status, JSON.stringify(resultado?.error ?? resultado).slice(0, 500))
      const msg = resposta.status === 401
        ? 'A chave da API da Anthropic foi recusada. Confira o segredo ANTHROPIC_API_KEY.'
        : resposta.status === 429
          ? 'Muitas perguntas seguidas ou limite da conta da API atingido. Tente de novo em instantes.'
          : resultado?.error?.message?.includes('credit')
            ? 'A conta da API da Anthropic está sem créditos.'
            : 'A API do Claude não respondeu agora. Tente de novo.'
      return json({ erro: msg, codigo: 'api' }, 502)
    }

    const blocos = Array.isArray(resultado?.content) ? resultado.content : []
    const chamada = blocos.find((b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'responder')
    const textoSolto = blocos.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n').trim()

    return json({
      resposta: chamada?.input?.resposta ?? textoSolto ?? '',
      tabela: chamada?.input?.tabela ?? null,
      uso: resultado?.usage ?? null,
    })
  } catch (err) {
    console.error('assistente-claude:', err)
    return json({ erro: 'Erro inesperado no assistente.' }, 500)
  }
})
