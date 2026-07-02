
CREATE OR REPLACE FUNCTION public.registrar_pagamento_atomico(
  p_cliente_id uuid,
  p_incremento int,
  p_observacao text DEFAULT NULL,
  p_registrado_por text DEFAULT NULL
)
RETURNS public.clientes_parcelados
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente public.clientes_parcelados;
  v_parcelas_antes int;
  v_novas_parcelas int;
  v_nova_data date;
  v_valor_parcela numeric;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_cliente
  FROM public.clientes_parcelados
  WHERE id = p_cliente_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_parcelas_antes := v_cliente.parcelas_pagas;
  v_novas_parcelas := GREATEST(0, LEAST(v_cliente.total_parcelas, v_cliente.parcelas_pagas + p_incremento));

  IF v_novas_parcelas = v_parcelas_antes THEN
    RETURN v_cliente;
  END IF;

  IF p_incremento > 0 THEN
    v_nova_data := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
    v_valor_parcela := COALESCE(v_cliente.valor_parcela, v_cliente.valor_total / NULLIF(v_cliente.total_parcelas, 0));

    UPDATE public.clientes_parcelados
    SET parcelas_pagas = v_novas_parcelas,
        data_ultimo_pagamento = v_nova_data,
        em_revisao = false,
        mes_referencia_revisao = NULL,
        valor_pago_parcial = NULL,
        observacao_revisao = NULL
    WHERE id = p_cliente_id
    RETURNING * INTO v_cliente;

    INSERT INTO public.historico_pagamentos (cliente_id, valor_pago, numero_parcela, registrado_por)
    VALUES (p_cliente_id, v_valor_parcela, v_novas_parcelas, p_registrado_por);
  ELSE
    DELETE FROM public.historico_pagamentos
    WHERE cliente_id = p_cliente_id AND numero_parcela = v_parcelas_antes;

    IF v_novas_parcelas = 0 THEN
      v_nova_data := NULL;
    ELSE
      SELECT data_pagamento::date INTO v_nova_data
      FROM public.historico_pagamentos
      WHERE cliente_id = p_cliente_id
      ORDER BY numero_parcela DESC
      LIMIT 1;
    END IF;

    UPDATE public.clientes_parcelados
    SET parcelas_pagas = v_novas_parcelas,
        data_ultimo_pagamento = v_nova_data
    WHERE id = p_cliente_id
    RETURNING * INTO v_cliente;
  END IF;

  INSERT INTO public.movimentos_parcelas
    (cliente_id, user_id, tipo, delta_parcelas, parcelas_antes, parcelas_depois, observacao, registrado_por)
  VALUES
    (p_cliente_id, v_uid,
     CASE WHEN p_incremento > 0 THEN 'INCREMENTO' ELSE 'DECREMENTO' END,
     p_incremento, v_parcelas_antes, v_novas_parcelas, p_observacao, p_registrado_por);

  RETURN v_cliente;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_pagamento_atomico(uuid, int, text, text) TO authenticated;
