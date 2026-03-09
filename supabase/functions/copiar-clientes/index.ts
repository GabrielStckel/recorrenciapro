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

    // Use service role client to verify user from auth header
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      console.log('Auth error:', userError?.message)
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { email_socio, cliente_ids } = body
    console.log('Request:', { email_socio, cliente_ids_count: cliente_ids?.length, user_id: user.id })

    if (!email_socio || !Array.isArray(cliente_ids) || cliente_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Email do sócio e lista de clientes são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find partner by email using admin API with filter
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    
    if (listError) {
      console.log('List users error:', listError.message)
      return new Response(JSON.stringify({ error: 'Erro ao buscar usuários: ' + listError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const emailNormalized = email_socio.toLowerCase().trim()
    const socio = usersData.users.find((u: any) => u.email?.toLowerCase() === emailNormalized)
    
    if (!socio) {
      console.log('Partner not found:', emailNormalized)
      return new Response(JSON.stringify({ error: 'Nenhuma conta encontrada com esse email' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (socio.id === user.id) {
      return new Response(JSON.stringify({ error: 'Você não pode copiar clientes para sua própria conta' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Partner found:', socio.id)

    // Get selected clients
    const { data: clientes, error: clientesError } = await supabaseAdmin
      .from('clientes_parcelados')
      .select('*')
      .eq('user_id', user.id)
      .in('id', cliente_ids)

    if (clientesError) {
      console.log('Fetch clients error:', clientesError.message)
      return new Response(JSON.stringify({ error: 'Erro ao buscar clientes: ' + clientesError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!clientes || clientes.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum cliente encontrado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Clients found:', clientes.length)

    const clientesParaSocio = clientes.map((c: any) => ({
      user_id: socio.id,
      cliente_nome: c.cliente_nome,
      whatsapp: c.whatsapp,
      produto: c.produto,
      valor_total: 0,
      total_parcelas: c.total_parcelas,
      parcelas_pagas: c.parcelas_pagas,
      data_inicio: c.data_inicio,
      data_ultimo_pagamento: c.data_ultimo_pagamento,
      dia_vencimento: c.dia_vencimento,
      status_cliente: c.status_cliente,
      em_revisao: c.em_revisao,
      mes_referencia_revisao: c.mes_referencia_revisao,
    }))

    const { error: insertError } = await supabaseAdmin
      .from('clientes_parcelados')
      .insert(clientesParaSocio)

    if (insertError) {
      console.log('Insert error:', insertError.message)
      return new Response(JSON.stringify({ error: 'Erro ao copiar clientes: ' + insertError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Success: copied', clientes.length, 'clients')

    return new Response(JSON.stringify({
      success: true,
      message: `${clientes.length} cliente(s) copiados para ${email_socio} (valores zerados para o sócio configurar)`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno: ' + (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
