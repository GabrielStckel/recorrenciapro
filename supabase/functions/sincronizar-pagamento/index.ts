import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { currentMonthSaoPaulo } from '../_shared/date-sp.ts'

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
      // Buscar parcelas atuais do parceiro para registrar movimento
      const { data: parceiroAntes } = await supabaseAdmin
        .from('clientes_parcelados')
        .select('parcelas_pagas, valor_total, valor_parcela, total_parcelas')
        .eq('id', parceiroClienteId)
        .single()

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

      // Registrar movimento espelhado no parceiro
      if (!error && parceiroAntes) {
        const delta = body.parcelas_pagas - parceiroAntes.parcelas_pagas
        if (delta !== 0) {
          await supabaseAdmin.from('movimentos_parcelas').insert({
            cliente_id: parceiroClienteId,
            tipo: delta > 0 ? 'INCREMENTO' : 'DECREMENTO',
            delta_parcelas: delta,
            parcelas_antes: parceiroAntes.parcelas_pagas,
            parcelas_depois: body.parcelas_pagas,
            observacao: 'Sincronizado do sócio',
            registrado_por: user.email,
          })

          // Histórico de pagamento espelhado quando incrementa
          if (delta > 0) {
            const valorParcela = parceiroAntes.valor_parcela != null
              ? Number(parceiroAntes.valor_parcela)
              : parceiroAntes.valor_total / parceiroAntes.total_parcelas
            await supabaseAdmin.from('historico_pagamentos').insert({
              cliente_id: parceiroClienteId,
              valor_pago: valorParcela,
              numero_parcela: body.parcelas_pagas,
              registrado_por: user.email,
            })
          }
        }
      }

    } else if (action === 'pagamento_removido') {
      const { data: parceiroAntes } = await supabaseAdmin
        .from('clientes_parcelados')
        .select('parcelas_pagas')
        .eq('id', parceiroClienteId)
        .single()

      // Se for decremento, apagar a linha específica do histórico do sócio
      // correspondente à parcela desfeita (maior numero_parcela = parcelas_pagas antes).
      if (parceiroAntes && body.parcelas_pagas < parceiroAntes.parcelas_pagas) {
        const { data: linhasParcela } = await supabaseAdmin
          .from('historico_pagamentos')
          .select('id, data_pagamento')
          .eq('cliente_id', parceiroClienteId)
          .eq('numero_parcela', parceiroAntes.parcelas_pagas)
          .order('data_pagamento', { ascending: false })
          .limit(1)

        if (linhasParcela && linhasParcela.length > 0) {
          await supabaseAdmin
            .from('historico_pagamentos')
            .delete()
            .eq('id', linhasParcela[0].id)
        }
      }

      const { error } = await supabaseAdmin
        .from('clientes_parcelados')
        .update({
          parcelas_pagas: body.parcelas_pagas,
          data_ultimo_pagamento: body.data_ultimo_pagamento,
        })
        .eq('id', parceiroClienteId)
      updateError = error

      if (!error && parceiroAntes) {
        const delta = body.parcelas_pagas - parceiroAntes.parcelas_pagas
        if (delta !== 0) {
          await supabaseAdmin.from('movimentos_parcelas').insert({
            cliente_id: parceiroClienteId,
            tipo: delta > 0 ? 'INCREMENTO' : 'DECREMENTO',
            delta_parcelas: delta,
            parcelas_antes: parceiroAntes.parcelas_pagas,
            parcelas_depois: body.parcelas_pagas,
            observacao: 'Sincronizado do sócio (estorno)',
            registrado_por: user.email,
          })
        }
      }

    } else if (action === 'marcado_atrasado') {
      const mesAtual = currentMonthSaoPaulo()
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
      // Sync only whitelisted editable fields. NEVER payment/review state.
      const syncFields: Record<string, unknown> = {}
      if (body.cliente_nome !== undefined) syncFields.cliente_nome = body.cliente_nome
      if (body.whatsapp !== undefined) syncFields.whatsapp = body.whatsapp
      if (body.produto !== undefined) syncFields.produto = body.produto
      if (body.dia_vencimento !== undefined) syncFields.dia_vencimento = body.dia_vencimento
      if (body.data_inicio !== undefined) syncFields.data_inicio = body.data_inicio
      if (body.status_cliente !== undefined) syncFields.status_cliente = body.status_cliente

      // Recompute financial values proportionally when valor_parcela or total_parcelas changed
      const valorMudou = body.valor_parcela !== undefined
      const totalMudou = body.total_parcelas !== undefined

      if (valorMudou || totalMudou) {
        const senderIsCliente = link.cliente_id === cliente_id
        const percSender = Number(senderIsCliente ? link.percentual_user : link.percentual_parceiro) || 0
        const percReceiver = Number(senderIsCliente ? link.percentual_parceiro : link.percentual_user) || 0

        const { data: socio } = await supabaseAdmin
          .from('clientes_parcelados')
          .select('valor_parcela, valor_total, total_parcelas')
          .eq('id', parceiroClienteId)
          .single()

        const round2 = (x: number) => Math.round(x * 100) / 100

        // Derive full-contract (100%) installment
        let contratoParcela = 0
        if (valorMudou && percSender > 0) {
          contratoParcela = Number(body.valor_parcela) / (percSender / 100)
        } else if (socio && percReceiver > 0) {
          const socioParcela = socio.valor_parcela != null
            ? Number(socio.valor_parcela)
            : (socio.total_parcelas ? Number(socio.valor_total) / Number(socio.total_parcelas) : 0)
          contratoParcela = socioParcela / (percReceiver / 100)
        }

        const totalParcelasFinal = totalMudou
          ? Number(body.total_parcelas)
          : (socio ? Number(socio.total_parcelas) : 0)

        if (contratoParcela > 0 && percReceiver > 0) {
          const novaParcelaSocio = round2(contratoParcela * (percReceiver / 100))
          syncFields.valor_parcela = novaParcelaSocio
          if (totalParcelasFinal > 0) {
            syncFields.valor_total = round2(novaParcelaSocio * totalParcelasFinal)
          }
        }
        if (totalMudou) syncFields.total_parcelas = Number(body.total_parcelas)
      }

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
