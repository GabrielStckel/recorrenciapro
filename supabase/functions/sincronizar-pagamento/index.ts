import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { cliente_id, action, parcelas_pagas, data_ultimo_pagamento } = await req.json()

    if (!cliente_id || !action) {
      return new Response(JSON.stringify({ error: 'cliente_id e action são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find linked partner client
    // Check both directions: user could be owner or partner
    const { data: links, error: linkError } = await supabaseAdmin
      .from('clientes_vinculados')
      .select('*')
      .or(`cliente_id.eq.${cliente_id},cliente_parceiro_id.eq.${cliente_id}`)

    if (linkError) {
      console.log('Error fetching links:', linkError.message)
      return new Response(JSON.stringify({ synced: false, reason: 'Erro ao buscar vínculo' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!links || links.length === 0) {
      // No link found - not an error, just no sync needed
      return new Response(JSON.stringify({ synced: false, reason: 'Cliente não vinculado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const link = links[0]
    // Determine partner's client ID
    const parceiroClienteId = link.cliente_id === cliente_id 
      ? link.cliente_parceiro_id 
      : link.cliente_id

    console.log(`Syncing action "${action}" from ${cliente_id} to partner ${parceiroClienteId}`)

    if (action === 'pagamento_confirmado') {
      // Sync: update partner's parcelas_pagas and data_ultimo_pagamento
      const updateData: Record<string, unknown> = {
        parcelas_pagas: parcelas_pagas,
        data_ultimo_pagamento: data_ultimo_pagamento,
        em_revisao: false,
        mes_referencia_revisao: null,
        valor_pago_parcial: null,
        observacao_revisao: null,
      }

      const { error: updateError } = await supabaseAdmin
        .from('clientes_parcelados')
        .update(updateData)
        .eq('id', parceiroClienteId)

      if (updateError) {
        console.log('Error syncing payment:', updateError.message)
        return new Response(JSON.stringify({ synced: false, reason: updateError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log('Payment synced successfully')
    } else if (action === 'pagamento_removido') {
      // Sync: decrement partner's parcelas
      const updateData: Record<string, unknown> = {
        parcelas_pagas: parcelas_pagas,
        data_ultimo_pagamento: data_ultimo_pagamento,
      }

      const { error: updateError } = await supabaseAdmin
        .from('clientes_parcelados')
        .update(updateData)
        .eq('id', parceiroClienteId)

      if (updateError) {
        console.log('Error syncing removal:', updateError.message)
        return new Response(JSON.stringify({ synced: false, reason: updateError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else if (action === 'marcado_atrasado') {
      // Sync: mark partner as late too
      const hoje = new Date()
      const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

      const { error: updateError } = await supabaseAdmin
        .from('clientes_parcelados')
        .update({
          em_revisao: false,
          mes_referencia_revisao: mesAtual,
          valor_pago_parcial: null,
          observacao_revisao: null,
        })
        .eq('id', parceiroClienteId)

      if (updateError) {
        console.log('Error syncing late status:', updateError.message)
      }
    } else if (action === 'status_alterado') {
      // Sync status change (ATIVO, PAUSADO, etc.)
      const { status_cliente } = await req.json().catch(() => ({}))
      if (status_cliente) {
        await supabaseAdmin
          .from('clientes_parcelados')
          .update({ status_cliente })
          .eq('id', parceiroClienteId)
      }
    }

    return new Response(JSON.stringify({ synced: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Sync error:', err)
    return new Response(JSON.stringify({ synced: false, reason: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
