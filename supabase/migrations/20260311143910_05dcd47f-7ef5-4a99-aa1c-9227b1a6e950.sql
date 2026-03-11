
-- Fix Rogerio: historico shows parcela 2 paid on 2026-03-11
UPDATE clientes_parcelados 
SET parcelas_pagas = 2, 
    data_ultimo_pagamento = '2026-03-11', 
    em_revisao = false, 
    mes_referencia_revisao = '2026-03',
    valor_pago_parcial = null,
    observacao_revisao = null
WHERE id = 'de63c2d8-509a-4356-bc3a-8370e4e8fbdc';

-- Fix Gláucia: historico shows parcela 2 paid on 2026-03-11
UPDATE clientes_parcelados 
SET parcelas_pagas = 2, 
    data_ultimo_pagamento = '2026-03-11', 
    em_revisao = false, 
    mes_referencia_revisao = '2026-03',
    valor_pago_parcial = null,
    observacao_revisao = null
WHERE id = 'e27edccf-c4a9-4b54-8b02-0d6487d14981';

-- Fix Tayana: historico shows parcela 3 paid on 2026-03-11
UPDATE clientes_parcelados 
SET parcelas_pagas = 3, 
    data_ultimo_pagamento = '2026-03-11', 
    em_revisao = false, 
    mes_referencia_revisao = '2026-03'
WHERE id = 'd289f3a2-e215-4253-8f51-e58fc8d573e9';
