## Objetivo
Corrigir o bug onde desfazer um pagamento (incremento negativo) deixa o registro em `historico_pagamentos` intacto — inflando faturamento e histórico — tanto localmente quanto no espelho do sócio. Também corrigir a `data_ultimo_pagamento` para refletir a data real do pagamento remanescente, não uma subtração de 1 mês.

Nenhum dado de cliente é apagado. A única remoção permitida é a linha específica de `historico_pagamentos` correspondente à parcela desfeita.

## Arquivos afetados

### 1. `src/hooks/useClientes.tsx` — `registrarPagamento` (linhas ~104-230)

**Mudança A — apagar a linha de histórico da parcela desfeita (incremento < 0):**
- Antes do `update` do cliente, quando `incremento < 0 && cliente.parcelas_pagas > 0`:
  - Buscar em `historico_pagamentos` a linha com `cliente_id = clienteId` e `numero_parcela = cliente.parcelas_pagas` (o maior número, correspondente à parcela mais recente).
  - Se houver mais de uma (defensivo), pegar a mais recente por `data_pagamento`/`created_at` e apagar apenas essa `id`.
  - `DELETE FROM historico_pagamentos WHERE id = <id>` — remoção pontual, não em massa.
  - Se não existir linha, seguir sem erro (idempotente).

**Mudança B — recalcular `data_ultimo_pagamento` a partir do histórico real:**
- Substituir o bloco atual (que usa `subMonthsClampedISO` no cliente atual) por: após deletar a linha acima, buscar em `historico_pagamentos` a linha remanescente com maior `numero_parcela` para aquele cliente.
  - Se existir → `novaDataUltimoPagamento = data_pagamento` (formatada como `YYYY-MM-DD` local).
  - Se não existir (ou `novasParcelas === 0`) → `novaDataUltimoPagamento = null`.
- Remover o helper `subMonthsClampedISO` do fluxo de decremento (pode ficar no arquivo se usado em outro lugar; verificar e limpar se órfão).

**Mudança C — propagar a data correta ao sócio:**
- A chamada `sincronizarParceiro(..., 'pagamento_removido', { parcelas_pagas, data_ultimo_pagamento: novaDataUltimoPagamento })` já existe; apenas passará o valor recalculado corretamente.

### 2. `supabase/functions/sincronizar-pagamento/index.ts` — action `pagamento_removido` (linhas ~120-149)

**Mudança D — apagar a linha correspondente no espelho do sócio:**
- Antes do `update`, dentro do bloco `pagamento_removido`:
  - Ler `parceiroAntes.parcelas_pagas` (já lido).
  - Se `body.parcelas_pagas < parceiroAntes.parcelas_pagas` (decremento):
    - Buscar em `historico_pagamentos` a linha com `cliente_id = parceiroClienteId` e `numero_parcela = parceiroAntes.parcelas_pagas` (mais recente por `data_pagamento` se houver múltiplas).
    - Apagar apenas essa `id`. Idempotente se não existir.
- Manter o `update` de `parcelas_pagas` e `data_ultimo_pagamento` como está (a data já virá recalculada do cliente principal via body).
- Manter o insert em `movimentos_parcelas` como está.

## Detalhes técnicos

- Ordem no cliente principal: (1) buscar cliente, (2) se decremento, apagar linha de histórico da maior `numero_parcela`, (3) recalcular `novaDataUltimoPagamento` a partir do histórico remanescente, (4) update do cliente, (5) registrar movimento DECREMENTO, (6) `sincronizarParceiro`.
- Nada de `DELETE` sem `id` específico; nada tocando `clientes_parcelados`, `movimentos_parcelas` ou linhas de outros números de parcela.
- Sem migração — apenas código.
- Comportamento de incremento (`> 0`) permanece inalterado.

## Fora de escopo
- `registrarPagamentoParcial` e demais fluxos.
- Qualquer alteração em `movimentos_parcelas` histórico já existente.
