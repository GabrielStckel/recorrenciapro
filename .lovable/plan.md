
# Correção do arredondamento de `valor_total` ao editar cliente

## Causa raiz
Hoje `valor_parcela` não existe no banco. O `ClienteModal` deriva parcela = `valor_total / total_parcelas`, arredonda para centavos ao exibir e, no submit, recalcula `valor_total = parcela * total_parcelas`. Em casos como R$1000 / 3 → 333,33 → 999,99. Ou seja, apenas abrir + salvar um cliente já corrompe o valor.

## Objetivo
1. `valor_parcela` passa a ser a fonte da verdade (persistida).
2. `valor_total` é derivado (`valor_parcela * total_parcelas`) — mantido no banco por compatibilidade e para consultas existentes, mas nunca sobrescrito quando o usuário não tocou no valor.
3. **Nada** dos dados atuais é apagado ou reescrito destrutivamente. Backfill é aditivo e idempotente.

---

## 1. Migração aditiva (nova, sem tocar dados existentes)

Arquivo: nova migração Supabase.

```sql
ALTER TABLE public.clientes_parcelados
  ADD COLUMN IF NOT EXISTS valor_parcela NUMERIC;

-- Backfill APENAS onde ainda está NULL. Não sobrescreve nada existente,
-- não altera valor_total, não toca historico_pagamentos nem movimentos_parcelas.
UPDATE public.clientes_parcelados
SET valor_parcela = ROUND(valor_total::numeric / NULLIF(total_parcelas, 0), 2)
WHERE valor_parcela IS NULL;
```

Sem `NOT NULL` na coluna (evita risco em qualquer linha órfã). Sem trigger, sem DROP, sem DELETE.

Nenhuma alteração em `historico_pagamentos` nem `movimentos_parcelas` — os registros de pagamento continuam intactos.

## 2. Tipos e cálculo — `src/types/cliente.ts`

- `Cliente`: adicionar `valor_parcela: number | null`.
- `calcularDadosCliente`: usar `cliente.valor_parcela ?? (valor_total / total_parcelas)` como fonte da parcela.
- Derivar `valor_total_exibicao = valor_parcela * total_parcelas` para todos os cálculos internos (valor pago, a receber, previsão). O campo `cliente.valor_total` bruto do banco fica apenas como fallback histórico.

## 3. `ClienteModal.tsx`

- No modo **edição**, `formData.valor_parcela` é preenchido a partir de `cliente.valor_parcela` (sem divisão). Fallback: divide `valor_total / total_parcelas` só se `valor_parcela` for null.
- Guardar `valorParcelaOriginalCents` ao abrir.
- No `handleSubmit`:
  - Se `cliente` existe e o campo valor não foi modificado (comparar em centavos com o original) **e** `total_parcelas` não mudou → enviar apenas os demais campos, **não** enviar `valor_parcela` nem `valor_total` no update.
  - Se o usuário editou o valor ou as parcelas → enviar `valor_parcela` (novo) e `valor_total = valor_parcela * total_parcelas` (derivado, para manter coluna sincronizada).
- Criação de novo cliente: enviar `valor_parcela` + `valor_total` derivado.

## 4. `src/hooks/useClientes.tsx`

- `addCliente`: incluir `valor_parcela` no insert.
- `updateCliente`: aceitar `valor_parcela` opcional; só inclui no `.update({...})` se veio no payload (permite edição "sem tocar no valor" não gravar nada relacionado a dinheiro).
- Optimistic updates: propagar `valor_parcela` no cache.

## 5. Consumidores que hoje dividem `valor_total / total_parcelas`

Trocar por `cliente.valor_parcela ?? valor_total/total_parcelas` (mesmo pattern do `calcularDadosCliente`). Arquivos a auditar/ajustar:

- `src/components/ForecastChart.tsx`
- `src/components/ExportarPrevisaoDialog.tsx`
- `src/components/ClientesAtrasados.tsx`
- `src/components/PagamentosEmRevisao.tsx`
- `src/components/ClientesTable.tsx`
- `src/components/MinhaEvolucao.tsx`
- `src/components/HistoricoModal.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Historico.tsx`
- `src/pages/Clientes.tsx`

(Em muitos casos já leem `ClienteCalculado.valor_parcela` — só preciso garantir que o `calcularDadosCliente` novo forneça a partir do banco.)

## 6. Edge functions que criam/copiam clientes para o sócio

Precisam gravar `valor_parcela` no INSERT do cliente parceiro (calculado a partir do valor proporcional). Não alteram registros existentes.

- `supabase/functions/criar-cliente-socio/index.ts`
- `supabase/functions/vincular-cliente-existente/index.ts`
- `supabase/functions/copiar-clientes/index.ts`
- `supabase/functions/sincronizar-clientes-parceiro/index.ts` — **NÃO** sincronizar `valor_parcela` nem `valor_total` (cada conta mantém o seu, igual à regra atual).

## 7. `historico_pagamentos` (sem migração)

Continua com `valor_pago` já registrado — não mexer em nada gravado. Novos pagamentos passam a usar `cliente.valor_parcela` (via `calcularDadosCliente`) ao invés de dividir `valor_total`. Ajuste apenas no ponto onde `useClientes` calcula o valor da parcela no momento de gravar novo pagamento.

## 8. Types gerados

`src/integrations/supabase/types.ts` é regenerado automaticamente após aprovar a migração — nenhum edit manual.

---

## Garantias de preservação de dados
- Migração só faz `ADD COLUMN` + `UPDATE ... WHERE valor_parcela IS NULL`.
- Nenhum `DELETE`, `TRUNCATE`, `DROP` em `clientes_parcelados`, `historico_pagamentos` ou `movimentos_parcelas`.
- `valor_total` das linhas existentes fica intocado.
- Edição sem alterar o campo de valor não envia `valor_parcela`/`valor_total` no update, então o banco permanece idêntico.

## Arquivos afetados (resumo)
- Nova migração SQL (add column + backfill condicional)
- `src/types/cliente.ts`
- `src/components/ClienteModal.tsx`
- `src/hooks/useClientes.tsx`
- `supabase/functions/criar-cliente-socio/index.ts`
- `supabase/functions/vincular-cliente-existente/index.ts`
- `supabase/functions/copiar-clientes/index.ts`
- Auditoria/ajustes menores nos componentes que dividem `valor_total / total_parcelas` (listados no item 5)
