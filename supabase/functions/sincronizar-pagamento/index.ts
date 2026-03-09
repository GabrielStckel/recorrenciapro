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

    const body = await req.json()
    const { cliente_id, action } = body

    if (!cliente_id || !action) {
      return new Response(JSON.stringify({ error: 'cliente_id e action são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find linked partner client
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
      return new Response(JSON.stringify({ synced: false, reason: 'Cliente não vinculado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const link = links[0]
    const parceiroClienteId = link.cliente_id === cliente_id
      ? link.cliente_parceiro_id
      : link.cliente_id

    console.log(`Syncing action "${action}" from ${cliente_id} to partner ${parceiroClienteId}`)

    let updateError = null

    if (action === 'pagamento_confirmado') {
      const { error } = await supabaseAdmin
        .from('clientes_parcelados')
        .update({
          parcelas_pagas: body.parcelas_pagas,
          data_ultimo_pagamento: body.data_ultimo_pagamento,
          em_revisao: false,
          mes_referencia_revisao: null,
          valor_pago_parcial: null,
          observacao_revisao: null,
        })
        .eq('id', parceiroClienteId)
      updateError = error

    } else if (action === 'pagamento_removido') {
      const { error } = await supabaseAdmin
        .from('clientes_parcelados')
        .update({
          parcelas_pagas: body.parcelas_pagas,
          data_ultimo_pagamento: body.data_ultimo_pagamento,
        })
        .eq('id', parceiroClienteId)
      updateError = error

    } else if (action === 'marcado_atrasado') {
      const hoje = new Date()
      const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
      const { error } = await supabaseAdmin
        .from('clientes_parcelados')
        .update({
          em_revisao: false,
          mes_referencia_revisao: mesAtual,
          valor_pago_parcial: null,
          observacao_revisao: null,
        })
        .eq('id', parceiroClienteId)
      updateError = error

    } else if (action === 'status_alterado') {
      const { error } = await supabaseAdmin
        .from('clientes_parcelados')
        .update({ status_cliente: body.status_cliente })
        .eq('id', parceiroClienteId)
      updateError = error

    } else if (action === 'cliente_editado') {
      // Sync editable fields (excluding valor_total which is % based)
      const syncFields: Record<string, unknown> = {}
      if (body.cliente_nome !== undefined) syncFields.cliente_nome = body.cliente_nome
      if (body.whatsapp !== undefined) syncFields.whatsapp = body.whatsapp
      if (body.produto !== undefined) syncFields.produto = body.produto
      if (body.total_parcelas !== undefined) syncFields.total_parcelas = body.total_parcelas
      if (body.parcelas_pagas !== undefined) syncFields.parcelas_pagas = body.parcelas_pagas
      if (body.dia_vencimento !== undefined) syncFields.dia_vencimento = body.dia_vencimento
      if (body.data_inicio !== undefined) syncFields.data_inicio = body.data_inicio
      if (body.data_ultimo_pagamento !== undefined) syncFields.data_ultimo_pagamento = body.data_ultimo_pagamento
      if (body.em_revisao !== undefined) syncFields.em_revisao = body.em_revisao
      if (body.mes_referencia_revisao !== undefined) syncFields.mes_referencia_revisao = body.mes_referencia_revisao
      if (body.valor_pago_parcial !== undefined) syncFields.valor_pago_parcial = body.valor_pago_parcial
      if (body.observacao_revisao !== undefined) syncFields.observacao_revisao = body.observacao_revisao
      if (body.status_cliente !== undefined) syncFields.status_cliente = body.status_cliente

      if (Object.keys(syncFields).length > 0) {
        const { error } = await supabaseAdmin
          .from('clientes_parcelados')
          .update(syncFields)
          .eq('id', parceiroClienteId)
        updateError = error
      }

    } else if (action === 'cliente_deletado') {
      // Delete partner's client and the link
      const { error: delError } = await supabaseAdmin
        .from('clientes_parcelados')
        .delete()
        .eq('id', parceiroClienteId)
      updateError = delError

      // Link will be cascade-deleted via FK if set, otherwise delete manually
      if (!updateError) {
        await supabaseAdmin
          .from('clientes_vinculados')
          .delete()
          .or(`cliente_id.eq.${cliente_id},cliente_parceiro_id.eq.${cliente_id}`)
      }

    } else if (action === 'entrou_revisao') {
      const { error } = await supabaseAdmin
        .from('clientes_parcelados')
        .update({
          em_revisao: true,
          mes_referencia_revisao: body.mes_referencia,
        })
        .eq('id', parceiroClienteId)
      updateError = error

    } else if (action === 'pagamento_parcial') {
      const { error } = await supabaseAdmin
        .from('clientes_parcelados')
        .update({
          valor_pago_parcial: body.valor_pago_parcial,
          observacao_revisao: body.observacao_revisao,
        })
        .eq('id', parceiroClienteId)
      updateError = error
    }

    if (updateError) {
      console.log(`Error syncing ${action}:`, updateError.message)
      return new Response(JSON.stringify({ synced: false, reason: updateError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Action "${action}" synced successfully`)
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
