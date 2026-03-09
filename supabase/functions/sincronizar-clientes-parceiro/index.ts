import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find all links where user is involved (either as owner or partner)
    const { data: links, error: linkError } = await supabaseAdmin
      .from('clientes_vinculados')
      .select('*')
      .or(`user_id.eq.${user.id},parceiro_user_id.eq.${user.id}`)

    if (linkError) {
      console.error('Error fetching links:', linkError.message)
      return new Response(JSON.stringify({ error: 'Erro ao buscar vínculos' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!links || links.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: 'Nenhum vínculo encontrado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let syncCount = 0

    for (const link of links) {
      // Determine which is the source (other user's client) and which is mine
      const isOwner = link.user_id === user.id
      const sourceClientId = isOwner ? link.cliente_parceiro_id : link.cliente_id
      const myClientId = isOwner ? link.cliente_id : link.cliente_parceiro_id

      // Fetch source client data (the other user's client)
      const { data: sourceClient, error: srcError } = await supabaseAdmin
        .from('clientes_parcelados')
        .select('*')
        .eq('id', sourceClientId)
        .maybeSingle()

      if (srcError || !sourceClient) {
        console.log(`Source client ${sourceClientId} not found, skipping`)
        continue
      }

      // Update my client with synced fields (excluding valor_total and user_id)
      const { error: updateError } = await supabaseAdmin
        .from('clientes_parcelados')
        .update({
          cliente_nome: sourceClient.cliente_nome,
          whatsapp: sourceClient.whatsapp,
          produto: sourceClient.produto,
          total_parcelas: sourceClient.total_parcelas,
          parcelas_pagas: sourceClient.parcelas_pagas,
          dia_vencimento: sourceClient.dia_vencimento,
          data_inicio: sourceClient.data_inicio,
          data_ultimo_pagamento: sourceClient.data_ultimo_pagamento,
          status_cliente: sourceClient.status_cliente,
          em_revisao: sourceClient.em_revisao,
          mes_referencia_revisao: sourceClient.mes_referencia_revisao,
          valor_pago_parcial: sourceClient.valor_pago_parcial,
          observacao_revisao: sourceClient.observacao_revisao,
        })
        .eq('id', myClientId)

      if (updateError) {
        console.log(`Error updating client ${myClientId}:`, updateError.message)
      } else {
        syncCount++
      }
    }

    return new Response(JSON.stringify({ synced: syncCount, total: links.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Sync error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
