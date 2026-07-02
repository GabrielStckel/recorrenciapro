## Bugs a corrigir
1. Edge functions usam `new Date()` sem fuso → `mes_referencia_revisao` e datas erram entre ~21h e 00h ou na virada de mês.
2. `confirmarPagamentoRevisao` grava `mes_referencia_revisao = mês atual` com `em_revisao = false` — mesma assinatura de "marcado como não pagou". Cliente pago pode virar atrasado se a data for editada depois.
3. `registrarPagamento` faz read-modify-write em passos separados → cliques concorrentes (usuário + sócio) podem perder/duplicar incremento.

## Plano (aditivo, sem mexer em dados existentes)

### 1. Helper de data no fuso America/Sao_Paulo
Criar arquivo `supabase/functions/_shared/date-sp.ts` (usado via import relativo pelas functions):
- `nowSaoPauloParts()` usando `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ... })` retornando `{ ano, mes, dia }`.
- `todayISOSaoPaulo()` → `YYYY-MM-DD`.
- `currentMonthSaoPaulo()` → `YYYY-MM`.

Substituir em:
- `supabase/functions/sincronizar-pagamento/index.ts` linha 171-172 (action `marcado_atrasado`).
- `supabase/functions/criar-cliente-socio/index.ts` linha 72 (`sharedCreatedAt`) — trocar por ISO com offset `-03:00` derivado do helper, para o timestamp refletir o "agora" em SP sem quebrar comparações.
- Auditar restante das functions e trocar qualquer outro `new Date()` remanescente que gere data/mês de negócio.

Nada de novos secrets, nada de migração.

### 2. Padronizar `confirmarPagamentoRevisao`
Em `src/hooks/useClientes.tsx` (mutation `confirmarPagamentoRevisao`, linhas ~303-416):
- No update do banco: `mes_referencia_revisao: null` (igual a `registrarPagamento` linha 225).
- No `onMutate` optimistic (linha ~379): também setar `mes_referencia_revisao: null`.
- Manter `em_revisao: false`, `valor_pago_parcial: null`, `observacao_revisao: null` como já estão.
- Não tocar em dados existentes; a mudança só afeta gravações futuras. `calcularDadosCliente` continua compatível com registros antigos que tenham `mes_referencia_revisao` preenchido.

### 3. RPC atômica para incremento/decremento de pagamento
Migração aditiva (não altera tabelas nem dados):

Criar função `public.registrar_pagamento_atomico(p_cliente_id uuid, p_incremento int, p_observacao text, p_registrado_por text)`:
- `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`.
- Faz `SELECT ... FROM clientes_parcelados WHERE id = p_cliente_id AND user_id = auth.uid() FOR UPDATE` — se não achar, `RAISE EXCEPTION 'not_authorized'` (valida dono).
- Calcula `novas_parcelas = GREATEST(0, LEAST(total_parcelas, parcelas_pagas + p_incremento))`. Se `novas_parcelas = parcelas_pagas`, retorna sem efeito colateral.
- Se incremento > 0:
  - `nova_data = (now() AT TIME ZONE 'America/Sao_Paulo')::date`.
  - `UPDATE clientes_parcelados SET parcelas_pagas = novas_parcelas, data_ultimo_pagamento = nova_data, em_revisao = false, mes_referencia_revisao = null, valor_pago_parcial = null, observacao_revisao = null`.
  - `INSERT INTO historico_pagamentos (cliente_id, valor_pago, numero_parcela, registrado_por)` usando `COALESCE(valor_parcela, valor_total / NULLIF(total_parcelas,0))`.
- Se incremento < 0:
  - `DELETE FROM historico_pagamentos WHERE cliente_id = p_cliente_id AND numero_parcela = parcelas_pagas` (linha exata da parcela desfeita).
  - Recalcula `data_ultimo_pagamento` a partir do `MAX(numero_parcela)` remanescente (ou `null`).
  - `UPDATE clientes_parcelados` apenas com `parcelas_pagas` e `data_ultimo_pagamento` (não mexe em flags de revisão).
- `INSERT INTO movimentos_parcelas (cliente_id, user_id, tipo, delta_parcelas, parcelas_antes, parcelas_depois, observacao, registrado_por)` com `tipo = CASE WHEN p_incremento > 0 THEN 'INCREMENTO' ELSE 'DECREMENTO' END`.
- Retorna a linha atualizada de `clientes_parcelados` (TABLE ou row) para o cliente atualizar cache.
- `GRANT EXECUTE ON FUNCTION ... TO authenticated;`

Em `src/hooks/useClientes.tsx` `registrarPagamento`:
- Substituir todo o bloco read→calc→update→insert (linhas 156-267) por uma única chamada `supabase.rpc('registrar_pagamento_atomico', { p_cliente_id, p_incremento, p_observacao, p_registrado_por })`.
- Usar a linha retornada para `calcularDadosCliente` e continuar disparando `sincronizarParceiro(...)` como fire-and-forget (sem mudar contrato do sync).
- Sem impacto em `registrarPagamentoParcial` nem em `confirmarPagamentoRevisao` (fora do escopo do bug 3).

## Arquivos afetados
- **Novo**: `supabase/functions/_shared/date-sp.ts`
- **Nova migração** (aditiva): função `registrar_pagamento_atomico` + GRANT
- `supabase/functions/sincronizar-pagamento/index.ts`
- `supabase/functions/criar-cliente-socio/index.ts`
- `src/hooks/useClientes.tsx` (`registrarPagamento` e `confirmarPagamentoRevisao`)

## Garantias
- Nenhum `UPDATE`/`DELETE` em dados existentes de clientes, histórico ou movimentos durante o deploy.
- Migração só cria função nova + GRANT.
- Registros antigos com `mes_referencia_revisao` preenchido continuam funcionando; a padronização vale só para novas confirmações.
