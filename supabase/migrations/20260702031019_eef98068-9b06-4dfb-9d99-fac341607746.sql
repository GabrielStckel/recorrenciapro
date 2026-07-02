
-- 1) historico_pagamentos: scope policies to authenticated
DROP POLICY IF EXISTS "Users can view their clients payment history" ON public.historico_pagamentos;
DROP POLICY IF EXISTS "Users can insert payment history for their clients" ON public.historico_pagamentos;
DROP POLICY IF EXISTS "Users can delete payment history for their clients" ON public.historico_pagamentos;

CREATE POLICY "Users can view their clients payment history"
  ON public.historico_pagamentos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clientes_parcelados c WHERE c.id = historico_pagamentos.cliente_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can insert payment history for their clients"
  ON public.historico_pagamentos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.clientes_parcelados c WHERE c.id = historico_pagamentos.cliente_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can delete payment history for their clients"
  ON public.historico_pagamentos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clientes_parcelados c WHERE c.id = historico_pagamentos.cliente_id AND c.user_id = auth.uid()));

-- 2) movimentos_parcelas (scoped via cliente_id; no user_id column)
DROP POLICY IF EXISTS "Users can view their clients movements" ON public.movimentos_parcelas;
DROP POLICY IF EXISTS "Users can insert movements for their clients" ON public.movimentos_parcelas;
DROP POLICY IF EXISTS "Users can delete movements for their clients" ON public.movimentos_parcelas;

CREATE POLICY "Users can view their clients movements"
  ON public.movimentos_parcelas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clientes_parcelados c WHERE c.id = movimentos_parcelas.cliente_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can insert movements for their clients"
  ON public.movimentos_parcelas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.clientes_parcelados c WHERE c.id = movimentos_parcelas.cliente_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can delete movements for their clients"
  ON public.movimentos_parcelas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clientes_parcelados c WHERE c.id = movimentos_parcelas.cliente_id AND c.user_id = auth.uid()));

-- 3) produtos
DROP POLICY IF EXISTS "Users can view their own produtos" ON public.produtos;
DROP POLICY IF EXISTS "Users can insert their own produtos" ON public.produtos;
DROP POLICY IF EXISTS "Users can update their own produtos" ON public.produtos;
DROP POLICY IF EXISTS "Users can delete their own produtos" ON public.produtos;

CREATE POLICY "Users can view their own produtos"
  ON public.produtos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own produtos"
  ON public.produtos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own produtos"
  ON public.produtos FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own produtos"
  ON public.produtos FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4) user_settings: scope to authenticated AND stop exposing payment_pin
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;

CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Revoke direct read/write of payment_pin from client roles; PIN is only touched via SECURITY DEFINER RPCs.
REVOKE SELECT (payment_pin), INSERT (payment_pin), UPDATE (payment_pin) ON public.user_settings FROM anon, authenticated, PUBLIC;

-- Server-side helpers to work with the PIN without exposing it.
CREATE OR REPLACE FUNCTION public.user_has_payment_pin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_settings
    WHERE user_id = auth.uid() AND payment_pin IS NOT NULL AND payment_pin <> ''
  );
$$;

CREATE OR REPLACE FUNCTION public.verify_payment_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stored text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT payment_pin INTO v_stored
  FROM public.user_settings
  WHERE user_id = auth.uid();

  IF v_stored IS NULL OR v_stored = '' THEN
    RETURN true;
  END IF;

  RETURN v_stored = _pin;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_payment_pin(_pin text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _pin IS NULL OR length(_pin) < 4 THEN
    RAISE EXCEPTION 'invalid_pin';
  END IF;

  INSERT INTO public.user_settings (user_id, payment_pin)
  VALUES (auth.uid(), _pin)
  ON CONFLICT (user_id) DO UPDATE SET payment_pin = EXCLUDED.payment_pin, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_has_payment_pin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_payment_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_payment_pin(text) TO authenticated;

-- Fix RPC created in previous turn: movimentos_parcelas has no user_id column.
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
    (cliente_id, tipo, delta_parcelas, parcelas_antes, parcelas_depois, observacao, registrado_por)
  VALUES
    (p_cliente_id,
     CASE WHEN p_incremento > 0 THEN 'INCREMENTO' ELSE 'DECREMENTO' END,
     p_incremento, v_parcelas_antes, v_novas_parcelas, p_observacao, p_registrado_por);

  RETURN v_cliente;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_pagamento_atomico(uuid, int, text, text) TO authenticated;

-- 5) realtime.messages: default-deny (RLS enabled with no permissive policies).
-- The app does not use broadcast/presence channels.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
