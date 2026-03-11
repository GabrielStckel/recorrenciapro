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

    const { cliente_id, email_socio, percentual_user, percentual_parceiro } = await req.json()

    if (!cliente_id || !email_socio || !percentual_user || !percentual_parceiro) {
      return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (Math.abs(percentual_user + percentual_parceiro - 100) > 0.01) {
      return new Response(JSON.stringify({ error: 'Percentuais devem somar 100%' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if client belongs to user
    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes_parcelados')
      .select('*')
      .eq('id', cliente_id)
      .eq('user_id', user.id)
      .single()

    if (clienteError || !cliente) {
      return new Response(JSON.stringify({ error: 'Cliente não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if already linked
    const { data: existingLink } = await supabaseAdmin
      .from('clientes_vinculados')
      .select('id')
      .eq('cliente_id', cliente_id)
      .maybeSingle()

    if (existingLink) {
      return new Response(JSON.stringify({ error: 'Este cliente já está vinculado a um sócio' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find partner
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1, perPage: 1000,
    })
    if (listError) {
      return new Response(JSON.stringify({ error: 'Erro ao buscar usuários' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const emailNormalized = email_socio.toLowerCase().trim()
    const socio = usersData.users.find((u: any) => u.email?.toLowerCase() === emailNormalized)

    if (!socio) {
      return new Response(JSON.stringify({ error: 'Nenhuma conta encontrada com esse email' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (socio.id === user.id) {
      return new Response(JSON.stringify({ error: 'Você não pode vincular a sua própria conta' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find matching client in partner's account (same name)
    const { data: clientesParceiro } = await supabaseAdmin
      .from('clientes_parcelados')
      .select('id, cliente_nome')
      .eq('user_id', socio.id)
      .ilike('cliente_nome', cliente.cliente_nome)

    let clienteParceiroId: string

    if (clientesParceiro && clientesParceiro.length > 0) {
      // Found matching client in partner's account
      clienteParceiroId = clientesParceiro[0].id
    } else {
      // Ensure product exists in partner's account
      if (cliente.produto) {
        const { data: existingProduto } = await supabaseAdmin
          .from('produtos')
          .select('id')
          .eq('user_id', socio.id)
          .eq('nome', cliente.produto)
          .maybeSingle()

        if (!existingProduto) {
          await supabaseAdmin
            .from('produtos')
            .insert({ nome: cliente.produto, user_id: socio.id })
        }
      }

      // Create client in partner's account with proportional value
      const valorParceiro = cliente.valor_total * (percentual_parceiro / 100)
      const { data: novoCiente, error: insertError } = await supabaseAdmin
        .from('clientes_parcelados')
        .insert({
          user_id: socio.id,
          cliente_nome: cliente.cliente_nome,
          whatsapp: cliente.whatsapp,
          produto: cliente.produto,
          valor_total: valorParceiro,
          total_parcelas: cliente.total_parcelas,
          parcelas_pagas: cliente.parcelas_pagas,
          data_inicio: cliente.data_inicio,
          data_ultimo_pagamento: cliente.data_ultimo_pagamento,
          dia_vencimento: cliente.dia_vencimento,
          status_cliente: cliente.status_cliente,
          em_revisao: cliente.em_revisao,
          mes_referencia_revisao: cliente.mes_referencia_revisao,
          created_at: cliente.created_at,
        })
        .select('id')
        .single()

      if (insertError) {
        return new Response(JSON.stringify({ error: 'Erro ao criar cliente no sócio: ' + insertError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      clienteParceiroId = novoCiente.id
    }

    // Update user's client value to their percentage
    const valorUser = cliente.valor_total * (percentual_user / 100)
    await supabaseAdmin
      .from('clientes_parcelados')
      .update({ valor_total: valorUser })
      .eq('id', cliente_id)

    // Create link
    const { error: linkError } = await supabaseAdmin
      .from('clientes_vinculados')
      .insert({
        cliente_id: cliente_id,
        cliente_parceiro_id: clienteParceiroId,
        user_id: user.id,
        parceiro_user_id: socio.id,
        percentual_user: percentual_user,
        percentual_parceiro: percentual_parceiro,
      })

    if (linkError) {
      return new Response(JSON.stringify({ error: 'Erro ao criar vínculo: ' + linkError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Cliente vinculado com sucesso! Valores ajustados: você ${percentual_user}% / sócio ${percentual_parceiro}%`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno: ' + (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
