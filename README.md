# Recorrência Pro

Painel para controlar vendas parceladas mês a mês — clientes que pagam em parcelas recorrentes
(Parcelamento Inteligente, assinatura e boleto/PIX da Hotmart) e que a Hotmart não mostra de forma
clara: quem pagou no mês, quem está atrasado, quanto falta receber e a previsão por mês.

- App publicado: https://recorrenciapro.lovable.app
- Projeto no Lovable: https://lovable.dev/projects/304ec08c-be9e-4310-826b-3030d82defb0
- Back-end: Lovable Cloud (Supabase `dozitkhxnoesyeneopca`)

Mudanças feitas no Lovable são enviadas para a `main` deste repositório, e o que for enviado para a
`main` aparece no editor do Lovable. O site publicado só muda depois de **Publish** no Lovable.

## Como os valores funcionam

Cada conta guarda **a sua parte** de cada venda, não o preço cheio. Para quem recebe 30% de uma venda da
Hotmart:

```
parcela no Recorrência Pro = (preço da parcela na Hotmart − 8,9% − R$ 1) × 30%
```

Ex.: parcela de R$ 500 → (500 − 44,50 − 1) × 0,30 = **R$ 136,35**. O valor da parcela (`valor_parcela`) é a
fonte da verdade; `valor_total` é derivado (`valor_parcela × total_parcelas`).

## Regras de status

O status é calculado no front-end em `src/types/cliente.ts` (`calcularDadosCliente`) e só vale para
clientes `ATIVO` com parcelas pendentes.

| Status | Quando |
|---|---|
| **Em dia** | `parcelas_pagas` cobre todos os vencimentos até hoje. |
| **Em revisão** | O vencimento do mês passou, não há pagamento no mês e ninguém clicou "Não pagou". Só sai por **Pagou**, **Não pagou** ou **+1** — nunca sozinho (ver `.lovable/plan.md`). |
| **Atrasado** | Marcado "Não pagou" no mês (`mes_referencia_revisao = AAAA-MM` e `em_revisao = false`) ou com parcelas de meses anteriores em aberto. |

- Primeira parcela: vence no mês de início se `data_inicio` ≤ dia de vencimento; senão, no mês seguinte.
- Dia 29–31 em meses curtos vira o último dia do mês.
- Revisão e atraso são mutuamente exclusivos na tela.
- O Dashboard grava `em_revisao = true` no banco quando um cliente entra em revisão, para o sócio ver o mesmo estado.

Status do cliente: `ATIVO`, `PAUSADO`, `CANCELADO` (assinatura cancelada na Hotmart), `QUITADO` (todas as
parcelas pagas). Só `ATIVO` entra nos totais e listas de cobrança.

## Estrutura

```
src/
  types/cliente.ts           regras de vencimento, status e atraso
  hooks/useClientes.tsx      leitura e mutações (pagamento, revisão, parcial, sócio)
  pages/Dashboard.tsx        KPIs, revisão, previsão, atrasados
  pages/Clientes.tsx         tabela, cadastro, cobranças futuras
  pages/Historico.tsx        log de +1/-1 (movimentos_parcelas)
  pages/ComoUsar.tsx         manual dentro do app
supabase/
  migrations/                esquema (aplicado pelo Lovable)
  functions/                 edge functions de sócio (service role)
```

### Tabelas

| Tabela | Para quê |
|---|---|
| `clientes_parcelados` | Um registro por venda parcelada (por conta). |
| `historico_pagamentos` | Uma linha por parcela paga. |
| `movimentos_parcelas` | Log de cada +1/-1, com quem registrou e observação. |
| `clientes_vinculados` | Liga o mesmo cliente em duas contas (você e o sócio) com os percentuais. |
| `cobrancas_futuras` | Entradas pagas cuja recorrência começa depois (data para enviar o link). |
| `produtos` | Lista de produtos por conta. |
| `user_settings` | Avatar e PIN de confirmação (o PIN só é lido por RPC no servidor). |

### Funções no banco

- `registrar_pagamento_atomico(cliente, incremento, observação, registrado_por)` — +1/-1 numa transação
  (parcelas, data do último pagamento, histórico, movimento e limpeza da revisão). Usada pelo +1, pelo
  "Pagou" da revisão e pelo "Confirmar Pagamento" dos atrasados.
- `user_has_payment_pin`, `verify_payment_pin`, `set_payment_pin` — PIN sem expor o valor.

### Edge functions (sócio)

| Função | Faz |
|---|---|
| `criar-cliente-socio` | Cria o cliente nas duas contas com os percentuais e o vínculo. |
| `vincular-cliente-existente` | Vincula um cliente já cadastrado ao sócio e ajusta os valores. |
| `sincronizar-pagamento` | Repete no sócio cada ação feita num cliente vinculado. Só aceita clientes do próprio usuário. |
| `sincronizar-clientes-parceiro` | Roda ao abrir o Dashboard: alinha clientes vinculados e, por nome + produto, os copiados sem vínculo — só entre sócios já vinculados. |
| `copiar-clientes` | Copia clientes para a conta do sócio com valores zerados. |

## Conferir com a Hotmart

1. Na Hotmart: **Assinaturas** e **Parcelamento Inteligente** de cada aluno (parcelas pagas, em aberto, cancelada).
2. No Recorrência Pro: `parcelas_pagas` = número de parcelas com status pago na Hotmart.
3. Assinatura cancelada na Hotmart → cliente `CANCELADO` (ou mantenha `ATIVO` em atraso se ainda for cobrar).
4. 10/10 pagas → `QUITADO`.

## Rodar localmente

```sh
npm install
npm run dev
```

Requer o `.env` com `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID`.
