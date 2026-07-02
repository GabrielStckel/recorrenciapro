## Objetivo
Corrigir 3 bugs na sincronização de edição entre contas vinculadas, sem alterar dados de clientes fora dos campos explicitamente citados.

## Descoberta importante
`clientes_vinculados` **já tem** as colunas `percentual_user` e `percentual_parceiro` e todos os 7 vínculos estão com valores preenchidos. **Nenhuma migração é necessária.**

## Arquivos afetados

### 1. `src/hooks/useClientes.tsx` — `updateCliente` (linhas ~59-81)

**Enviar ao sync somente o diff, e nunca campos de pagamento/revisão.**

- Aceitar um parâmetro extra opcional `previous?: Cliente` (o cliente antes do update, vindo do ClienteModal / ClientesTable) para calcular o diff. Se não vier, buscar via `select` antes do update.
- Após atualizar, montar `syncPayload` contendo apenas as chaves cujo valor mudou (`updates[k] !== previous[k]`) e apenas entre os campos permitidos:
  - `cliente_nome, whatsapp, produto, total_parcelas, valor_parcela, valor_total, dia_vencimento, data_inicio, status_cliente`
- Bloqueio explícito (nunca enviados, mesmo se vierem em `updates`):
  - `parcelas_pagas, data_ultimo_pagamento, em_revisao, mes_referencia_revisao, valor_pago_parcial, observacao_revisao`
- Se `syncPayload` estiver vazio, não chamar `sincronizarParceiro`.
- Nas chamadas atuais (`ClienteModal.handleSubmit`, `ClientesTable.handleStatusChange`) passar `previous: cliente` para evitar o `select` extra.

### 2. `supabase/functions/sincronizar-pagamento/index.ts` — action `cliente_editado` (linhas ~191-214)

**Recalcular valores proporcionalmente e nunca sobrescrever estado de pagamento/revisão do sócio.**

- Remover do whitelist: `parcelas_pagas, data_ultimo_pagamento, em_revisao, mes_referencia_revisao, valor_pago_parcial, observacao_revisao`. Continuar aceitando: `cliente_nome, whatsapp, produto, total_parcelas, dia_vencimento, data_inicio, status_cliente`.
- Ler o vínculo com `percentual_user` e `percentual_parceiro` (já disponível — `link` já é selecionado com `*`). Identificar qual lado é o remetente e qual é o sócio (`percSender`, `percReceiver`).
- Se `body.valor_parcela !== undefined` **ou** `body.total_parcelas !== undefined`:
  - Buscar do sócio (`supabaseAdmin.from('clientes_parcelados').select('valor_parcela, valor_total, total_parcelas').eq('id', parceiroClienteId).single()`) para ter os valores atuais.
  - Determinar `totalParcelasFinal`:
    - Se `body.total_parcelas !== undefined` → usa `body.total_parcelas` (mesma quantidade dos dois lados).
    - Caso contrário mantém o do sócio.
  - Determinar `valorParcelaContratoTotal` (parcela do contrato inteiro, 100%):
    - Se `body.valor_parcela !== undefined` → o remetente enviou a parcela DELE, então `contratoParcela = body.valor_parcela / (percSender/100)`.
    - Caso contrário derivar do sócio: `contratoParcela = socio.valor_parcela / (percReceiver/100)` (fallback: `socio.valor_total / socio.total_parcelas / (percReceiver/100)`).
  - `syncFields.valor_parcela = round2(contratoParcela * (percReceiver/100))`
  - `syncFields.valor_total = round2(syncFields.valor_parcela * totalParcelasFinal)`
  - `syncFields.total_parcelas = totalParcelasFinal` (se veio no body).
- `round2(x) = Math.round(x * 100) / 100`.
- Se nenhum campo terminar no `syncFields`, não fazer update.

### 3. `src/components/ClienteModal.tsx` (linha ~253) e `src/components/ClientesTable.tsx` (linha ~237)

- Passar `previous: cliente` no `updateCliente.mutateAsync({ id, ...data, previous: cliente })` — pequena assinatura extra tratada em (1) para não sair no update de banco (extraída antes do `.update`).

## Detalhes técnicos
- Percentuais são NUMERIC 0-100 (soma = 100). Divisão por zero é evitada com fallback `>0`.
- `updateCliente` continua gravando no banco do remetente exatamente o que já grava hoje — apenas a chamada `sincronizarParceiro` é filtrada.
- Sem migração; sem toque em `movimentos_parcelas` ou `historico_pagamentos`.

## Fora de escopo
- Fluxos de pagamento (`pagamento_confirmado`/`pagamento_removido`/`pagamento_parcial`) e `entrou_revisao`/`marcado_atrasado` continuam como estão.
- Criação de cliente com sócio (`criar-cliente-socio`).
