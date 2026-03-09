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
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client with user's token to verify identity
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email_socio, percentual } = await req.json()

    if (!email_socio || typeof percentual !== 'number' || percentual <= 0 || percentual > 100) {
      return new Response(JSON.stringify({ error: 'Email do sócio e percentual (1-100) são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Admin client to look up partner and insert data
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Find partner user by email
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      return new Response(JSON.stringify({ error: 'Erro ao buscar usuários' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const socio = usersData.users.find(u => u.email === email_socio.toLowerCase().trim())
    if (!socio) {
      return new Response(JSON.stringify({ error: 'Nenhuma conta encontrada com esse email' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (socio.id === user.id) {
      return new Response(JSON.stringify({ error: 'Você não pode copiar clientes para sua própria conta' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get current user's clients
    const { data: clientes, error: clientesError } = await supabaseAdmin
      .from('clientes_parcelados')
      .select('*')
      .eq('user_id', user.id)

    if (clientesError) {
      return new Response(JSON.stringify({ error: 'Erro ao buscar clientes' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!clientes || clientes.length === 0) {
      return new Response(JSON.stringify({ error: 'Você não possui clientes para copiar' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fator = percentual / 100

    // Prepare clients for partner
    const clientesParaSocio = clientes.map(c => ({
      user_id: socio.id,
      cliente_nome: c.cliente_nome,
      whatsapp: c.whatsapp,
      produto: c.produto,
      valor_total: Math.round(c.valor_total * fator * 100) / 100,
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
      return new Response(JSON.stringify({ error: 'Erro ao copiar clientes: ' + insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `${clientes.length} clientes copiados para ${email_socio} com ${percentual}% do valor` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Erro interno: ' + err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
