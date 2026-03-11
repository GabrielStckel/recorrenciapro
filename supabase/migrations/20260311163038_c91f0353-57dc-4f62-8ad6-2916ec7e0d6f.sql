
ALTER TABLE public.cobrancas_futuras
  ADD COLUMN valor_total NUMERIC DEFAULT 0,
  ADD COLUMN total_parcelas INTEGER DEFAULT 1,
  ADD COLUMN dia_vencimento INTEGER DEFAULT 10,
  ADD COLUMN com_socio BOOLEAN DEFAULT false,
  ADD COLUMN email_socio TEXT,
  ADD COLUMN percentual_user NUMERIC DEFAULT 50,
  ADD COLUMN percentual_parceiro NUMERIC DEFAULT 50;
