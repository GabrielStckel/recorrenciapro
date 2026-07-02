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
    const { cliente_data, email_socio, percentual_user, percentual_parceiro, valor_total_parceiro } = body

    if (!cliente_data || !email_socio || !percentual_user || !percentual_parceiro) {
      return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find partner
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listError) {
      return new Response(JSON.stringify({ error: 'Erro ao buscar usuários' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const socio = usersData.users.find((u: any) => u.email?.toLowerCase() === email_socio.toLowerCase().trim())
    if (!socio) {
      return new Response(JSON.stringify({ error: 'Nenhuma conta encontrada com esse email' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (socio.id === user.id) {
      return new Response(JSON.stringify({ error: 'Você não pode vincular a si mesmo' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // User's valor_total comes directly from cliente_data (already calculated on frontend)
    const valorUser = cliente_data.valor_total
    // Partner's valor_total comes from frontend calculation or fallback
    const valorParceiro = valor_total_parceiro || Math.round(cliente_data.valor_total * (percentual_parceiro / percentual_user) * 100) / 100
    const totalParcelasNum = Number(cliente_data.total_parcelas) || 1
    const valorParcelaUser = Math.round((valorUser / totalParcelasNum) * 100) / 100
    const valorParcelaParceiro = Math.round((valorParceiro / totalParcelasNum) * 100) / 100

    // Create client for current user
    const sharedCreatedAt = new Date().toISOString()
    const { data: clienteUser, error: errUser } = await supabaseAdmin
      .from('clientes_parcelados')
      .insert({
        ...cliente_data,
        user_id: user.id,
        valor_total: valorUser,
        valor_parcela: valorParcelaUser,
        created_at: sharedCreatedAt,
      })
      .select()
      .single()

    if (errUser) {
      console.log('Error creating user client:', errUser.message)
      return new Response(JSON.stringify({ error: 'Erro ao criar cliente: ' + errUser.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Ensure product exists in partner's account
    if (cliente_data.produto) {
      const { data: existingProduto } = await supabaseAdmin
        .from('produtos')
        .select('id')
        .eq('user_id', socio.id)
        .eq('nome', cliente_data.produto)
        .maybeSingle()

      if (!existingProduto) {
        await supabaseAdmin
          .from('produtos')
          .insert({ nome: cliente_data.produto, user_id: socio.id })
      }
    }

    // Create client for partner
    const { data: clienteParceiro, error: errParceiro } = await supabaseAdmin
      .from('clientes_parcelados')
      .insert({
        ...cliente_data,
        user_id: socio.id,
        valor_total: valorParceiro,
        created_at: sharedCreatedAt,
      })
      .select()
      .single()

    if (errParceiro) {
      console.log('Error creating partner client:', errParceiro.message)
      // Rollback user client
      await supabaseAdmin.from('clientes_parcelados').delete().eq('id', clienteUser.id)
      return new Response(JSON.stringify({ error: 'Erro ao criar cliente para o sócio: ' + errParceiro.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create link
    const { error: linkError } = await supabaseAdmin
      .from('clientes_vinculados')
      .insert({
        cliente_id: clienteUser.id,
        cliente_parceiro_id: clienteParceiro.id,
        user_id: user.id,
        parceiro_user_id: socio.id,
        percentual_user: percentual_user,
        percentual_parceiro: percentual_parceiro,
      })

    if (linkError) {
      console.log('Error creating link:', linkError.message)
      // Still ok, clients were created - just no sync link
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Cliente criado nas duas contas! Seu valor: R$ ${valorUser.toFixed(2)} (${percentual_user}%) · Sócio: R$ ${valorParceiro.toFixed(2)} (${percentual_parceiro}%)`,
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
