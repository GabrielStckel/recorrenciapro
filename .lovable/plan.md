## Bug
Cliente em revisão aparece simultaneamente em "Pagamentos em Revisão" e em "Parcelas Atrasadas". Revisão e atraso devem ser mutuamente exclusivos na UI, e a saída da revisão só pode ocorrer via clique em "Pagou"/"Não pagou".

## Plano (sem mexer em dados)

### 1. `src/types/cliente.ts` — `calcularDadosCliente`
- Se `em_revisao === true`: `status = 'Em revisão'` incondicionalmente (remover o gate `revisaoAindaValida`).
- Continuar calculando `parcelas_atrasadas` e `dias_em_atraso` normalmente (para métricas internas), mas o status nunca vira `'Atrasado'` enquanto `em_revisao` for true.
- Nenhuma mudança em `expandirParcelasAtrasadas` além do filtro abaixo.

### 2. `src/types/cliente.ts` — `expandirParcelasAtrasadas`
- Adicionar `if (cliente.em_revisao) continue;` no loop, para não expandir parcelas de clientes em revisão.

### 3. `src/components/ClientesAtrasados.tsx`
- Como o filtro já será feito em `expandirParcelasAtrasadas`, não precisa mudar código aqui. Confirmar via leitura que nada mais reintroduz clientes em revisão (o componente só usa `expandirParcelasAtrasadas`).

### 4. `src/pages/Dashboard.tsx` — KPIs de atraso
- `clientesComAtraso`: adicionar `&& !c.em_revisao` ao filtro.
- Consequentemente `totalParcelasAtrasadas` e `valorEmAtraso` deixam de contar clientes em revisão.
- `clientesAtrasados` (`status === 'Atrasado'`) já ficará correto pela mudança em `calcularDadosCliente`.

### 5. `src/pages/Dashboard.tsx` — remover AUTO-SAÍDA de revisão
- Remover o bloco AUTO-EXIT (linhas ~113-122) que chama `sairDeRevisaoMutate`. Também remover `clientesLimposRef` e o import/uso de `sairDeRevisaoMutate` se ficarem órfãos (verificar antes de remover import para não quebrar tipos).
- Manter intacto o bloco AUTO-ENTER (linhas ~124-136): auto-entrada em revisão quando o vencimento do mês passa continua como está hoje.

## Arquivos afetados
- `src/types/cliente.ts`
- `src/pages/Dashboard.tsx`

## Garantias
- Nenhuma migração, nenhuma escrita em banco alterada. Só lógica de exibição e remoção da auto-saída de revisão.
- Dados existentes de clientes/histórico/movimentos permanecem inalterados.
- Auto-entrada em revisão preservada; saída só via botões "Pagou" / "Não pagou".
