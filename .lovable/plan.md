## Bug
Clientes que deveriam estar (ou estão) "Em revisão" aparecem em "Parcelas em Atraso". Causas:
- A auto-entrada em revisão só roda no `Dashboard` via `useEffect` (mutação assíncrona). Antes de completar — ou em qualquer outra tela — o cliente tem `em_revisao=false` no banco e `calcularDadosCliente` já o marca como `'Atrasado'`, expandindo TODAS as parcelas em atraso em `ClientesAtrasados`.
- Consequência: enquanto o back-fill não aconteceu, o cliente aparece nas duas listas ao mesmo tempo (ou só em atrasados) sem o usuário ter clicado em "Não pagou".

## Regra final (confirmada pelo usuário)
- Revisão e atraso são **mutuamente exclusivos** na exibição.
- Um cliente **só sai de revisão** por clique manual em "Pagou" ou "Não pagou". Nunca automaticamente, nunca por recomputação.
- Um cliente **só entra em "Atrasado"** depois que o usuário clicou em "Não pagou" para o mês em questão. Antes disso, se o vencimento passou e não há pagamento, é "Em revisão".

## Plano (sem migração, sem mexer em dados)

### 1. `src/types/cliente.ts` — `calcularDadosCliente`
Introduzir estado de revisão **computado** que se soma ao `em_revisao` gravado:

- Manter a lógica atual de `parcelasQueDeveriamEstarPagas` e `pagouEsteMes`.
- Definir `mesAtualStr = "YYYY-MM"`.
- Definir `foiMarcadoNaoPagouEsteMes = mes_referencia_revisao === mesAtualStr && em_revisao === false`.
- Definir `deveEstarEmRevisaoComputado`:
  - `parcelas_pendentes > 0`
  - `status_cliente === 'ATIVO'`
  - vencimento do mês atual já passou (`hoje > data_vencimento_mes_atual`)
  - **não** pagou neste mês
  - **não** foi marcado "não pagou" este mês (`!foiMarcadoNaoPagouEsteMes`)
- Novo campo derivado `em_revisao_efetivo = cliente.em_revisao || deveEstarEmRevisaoComputado`.
- Regra de status (substitui o bloco atual):
  - Se `em_revisao_efetivo` → `status = 'Em revisão'` (incondicional).
  - Senão, se `deveSerAtrasado` → `status = 'Atrasado'`.
  - Senão → `'Em dia'`.
- `parcelas_atrasadas` e `dias_em_atraso`: continuar sendo calculados como hoje (métricas internas), mas **zerar** quando `em_revisao_efetivo === true` para não vazarem em KPIs/expansão:
  - Se `em_revisao_efetivo` → `parcelas_atrasadas = 0`, `dias_em_atraso = 0`.
- Adicionar `em_revisao_efetivo: boolean` ao `ClienteCalculado`.

Efeito: mesmo antes do `useEffect` do Dashboard escrever `em_revisao=true`, o cliente já é tratado como em revisão em toda a UI (Dashboard, Clientes, Histórico, etc.).

### 2. `src/types/cliente.ts` — `expandirParcelasAtrasadas`
- Trocar `if (cliente.em_revisao) continue;` por `if (cliente.em_revisao_efetivo) continue;`.
- Como já zeramos `parcelas_atrasadas` para em-revisão, o loop naturalmente não gera linhas — mas manter o guard explícito por segurança.

### 3. `src/pages/Dashboard.tsx`
- `clientesComAtraso`: trocar `!c.em_revisao` por `!c.em_revisao_efetivo`.
- `clientesEmRevisao`: trocar `c.em_revisao` por `c.em_revisao_efetivo`.
- KPIs `totalParcelasAtrasadas` e `valorEmAtraso` passam automaticamente a excluir os em-revisão-computados.
- **Manter** o `useEffect` de auto-entrada em revisão como está: ele continua gravando `em_revisao=true` no banco para persistir o estado e sincronizar com o parceiro. Não é mais o gatilho da exibição, só do banco.
- **Não** reintroduzir auto-saída em nenhum ponto.

### 4. `src/components/PagamentosEmRevisao.tsx`
- Trocar o filtro `c.em_revisao && c.status_cliente === 'ATIVO'` por `c.em_revisao_efetivo && c.status_cliente === 'ATIVO'`.
- Assim clientes com revisão computada (ainda sem flag no banco) já aparecem no card.

### 5. `src/components/ClientesTable.tsx` e demais consumidores
- Verificar usos de `cliente.em_revisao` para exibição/filtro; onde a intenção for "está em revisão para o usuário", trocar para `em_revisao_efetivo`.
- Onde a intenção for "gravar/limpar flag no banco" (mutações), manter `em_revisao` como está.
- Passar arquivo por arquivo apenas depois da leitura (sem alterações especulativas).

### 6. Botões continuam sendo a única saída
- `confirmarPagamentoRevisao` (Pagou): já grava `em_revisao=false`, `mes_referencia_revisao=null`. Após isso, `pagouEsteMes = true` na próxima renderização → `em_revisao_efetivo = false` → sai de revisão. ✓
- `marcarComoAtrasado` (Não pagou): grava `em_revisao=false` e `mes_referencia_revisao=mesAtual`. Isso ativa `foiMarcadoNaoPagouEsteMes = true` → `em_revisao_efetivo = false` e cai em `Atrasado`. ✓
- Sem clique em nenhum dos dois, `em_revisao_efetivo` permanece `true`. ✓

## Arquivos afetados
- `src/types/cliente.ts` (lógica principal + novo campo)
- `src/pages/Dashboard.tsx` (filtros de KPI e listas)
- `src/components/PagamentosEmRevisao.tsx` (filtro)
- `src/components/ClientesTable.tsx` e outros consumidores de `em_revisao` (auditoria + troca pontual para `em_revisao_efetivo` onde for exibição)

## Garantias
- Nenhuma migração. Nenhum dado de cliente/histórico/movimento alterado.
- Auto-entrada em revisão preservada (segue gravando no banco para sincronizar com o sócio).
- Saída de revisão somente via "Pagou" ou "Não pagou".
- Um cliente nunca mais aparece simultaneamente em Revisão e Atrasados.
- Prior meses realmente atrasados só reaparecerão como atrasados quando o usuário clicar "Não pagou" para o mês corrente (comportamento pedido).
