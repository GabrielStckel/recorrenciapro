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

    // Fields to sync (excluding valor_total which is independent per user)
    const syncFields = (source: any) => ({
      cliente_nome: source.cliente_nome,
      whatsapp: source.whatsapp,
      produto: source.produto,
      total_parcelas: source.total_parcelas,
      parcelas_pagas: source.parcelas_pagas,
      dia_vencimento: source.dia_vencimento,
      data_inicio: source.data_inicio,
      data_ultimo_pagamento: source.data_ultimo_pagamento,
      status_cliente: source.status_cliente,
      em_revisao: source.em_revisao,
      mes_referencia_revisao: source.mes_referencia_revisao,
      valor_pago_parcial: source.valor_pago_parcial,
      observacao_revisao: source.observacao_revisao,
      created_at: source.created_at,
    })

    // Check if two records have different sync-relevant data
    const hasDataChanged = (source: any, target: any): boolean => {
      return (
        source.cliente_nome !== target.cliente_nome ||
        source.whatsapp !== target.whatsapp ||
        source.produto !== target.produto ||
        source.total_parcelas !== target.total_parcelas ||
        source.parcelas_pagas !== target.parcelas_pagas ||
        source.dia_vencimento !== target.dia_vencimento ||
        source.data_inicio !== target.data_inicio ||
        source.data_ultimo_pagamento !== target.data_ultimo_pagamento ||
        source.status_cliente !== target.status_cliente ||
        source.em_revisao !== target.em_revisao ||
        source.mes_referencia_revisao !== target.mes_referencia_revisao
      )
    }

    // Determine which record is the "source of truth"
    // Priority: higher parcelas_pagas wins, then more recent updated_at
    const shouldSync = (source: any, target: any): boolean => {
      // If source has more parcelas_pagas, it's ahead
      if (source.parcelas_pagas > target.parcelas_pagas) return true
      // If target has more, don't overwrite
      if (source.parcelas_pagas < target.parcelas_pagas) return false
      // Same parcelas_pagas: use updated_at as tiebreaker
      const sourceUpdated = new Date(source.updated_at).getTime()
      const targetUpdated = new Date(target.updated_at).getTime()
      if (sourceUpdated > targetUpdated) return true
      // If timestamps equal but data differs, still sync
      if (sourceUpdated === targetUpdated && hasDataChanged(source, target)) return true
      return false
    }

    // Strategy 1: Use formal links from clientes_vinculados
    const { data: links } = await supabaseAdmin
      .from('clientes_vinculados')
      .select('*')
      .or(`user_id.eq.${user.id},parceiro_user_id.eq.${user.id}`)

    let syncCount = 0

    if (links && links.length > 0) {
      for (const link of links) {
        const isOwner = link.user_id === user.id
        const sourceClientId = isOwner ? link.cliente_parceiro_id : link.cliente_id
        const myClientId = isOwner ? link.cliente_id : link.cliente_parceiro_id

        // Fetch both records to compare
        const [sourceRes, myRes] = await Promise.all([
          supabaseAdmin.from('clientes_parcelados').select('*').eq('id', sourceClientId).maybeSingle(),
          supabaseAdmin.from('clientes_parcelados').select('*').eq('id', myClientId).maybeSingle(),
        ])

        const sourceClient = sourceRes.data
        const myClient = myRes.data
        if (!sourceClient || !myClient) continue

        // Only sync if source has newer/better data
        if (!shouldSync(sourceClient, myClient)) {
          // Try reverse: maybe MY data should go to the source
          if (shouldSync(myClient, sourceClient)) {
            const { error: updateError } = await supabaseAdmin
              .from('clientes_parcelados')
              .update(syncFields(myClient))
              .eq('id', sourceClientId)
            if (!updateError) syncCount++
          }
          continue
        }

        const { error: updateError } = await supabaseAdmin
          .from('clientes_parcelados')
          .update(syncFields(sourceClient))
          .eq('id', myClientId)

        if (!updateError) syncCount++
      }
    }

    // Strategy 2: casar por nome os clientes copiados mas não vinculados.
    // Só procura nas contas dos SÓCIOS com quem este usuário já tem vínculo — antes buscava
    // em todas as contas do sistema, o que copiava dados de qualquer pessoa com cliente de mesmo nome.
    const partnerIds = [...new Set((links || []).map((l: any) => l.user_id === user.id ? l.parceiro_user_id : l.user_id))]
    if (partnerIds.length === 0) {
      return new Response(JSON.stringify({ synced: syncCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: myClients } = await supabaseAdmin
      .from('clientes_parcelados')
      .select('*')
      .eq('user_id', user.id)

    if (!myClients || myClients.length === 0) {
      return new Response(JSON.stringify({ synced: syncCount, message: 'Nenhum cliente encontrado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get IDs already handled via formal links
    const linkedMyIds = new Set(
      (links || []).map((l: any) => l.user_id === user.id ? l.cliente_id : l.cliente_parceiro_id)
    )

    const myClientNames = myClients
      .filter(c => !linkedMyIds.has(c.id))
      .map(c => c.cliente_nome)

    if (myClientNames.length === 0) {
      return new Response(JSON.stringify({ synced: syncCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Clientes dos sócios com o mesmo nome
    const { data: otherClients } = await supabaseAdmin
      .from('clientes_parcelados')
      .select('*')
      .in('user_id', partnerIds)
      .in('cliente_nome', myClientNames)

    if (!otherClients || otherClients.length === 0) {
      return new Response(JSON.stringify({ synced: syncCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // nome+produto -> clientes do sócio. Se houver mais de um candidato, não sincroniza
    // (ex.: a mesma pessoa comprou dois produtos) para não sobrescrever o cliente errado.
    const chave = (c: any) => `${c.cliente_nome}::${c.produto}`
    const sourcesByKey = new Map<string, any[]>()
    for (const c of otherClients) {
      const k = chave(c)
      sourcesByKey.set(k, [...(sourcesByKey.get(k) || []), c])
    }
    const myCountByKey = new Map<string, number>()
    for (const c of myClients) myCountByKey.set(chave(c), (myCountByKey.get(chave(c)) || 0) + 1)

    // Update my unlinked clients that have a single, unambiguous match
    for (const myClient of myClients) {
      if (linkedMyIds.has(myClient.id)) continue
      const candidatos = sourcesByKey.get(chave(myClient)) || []
      if (candidatos.length !== 1 || myCountByKey.get(chave(myClient)) !== 1) continue
      const source = candidatos[0]

      // Only sync if source has better data
      if (!shouldSync(source, myClient)) continue

      const { error: updateError } = await supabaseAdmin
        .from('clientes_parcelados')
        .update(syncFields(source))
        .eq('id', myClient.id)

      if (!updateError) syncCount++
      else console.log(`Error updating ${myClient.id}:`, updateError.message)
    }

    console.log(`Synced ${syncCount} clients for user ${user.id}`)

    return new Response(JSON.stringify({ synced: syncCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Sync error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
