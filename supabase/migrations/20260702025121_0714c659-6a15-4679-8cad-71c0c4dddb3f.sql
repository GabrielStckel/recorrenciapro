ALTER TABLE public.clientes_parcelados
  ADD COLUMN IF NOT EXISTS valor_parcela NUMERIC;

UPDATE public.clientes_parcelados
SET valor_parcela = ROUND(valor_total::numeric / NULLIF(total_parcelas, 0), 2)
WHERE valor_parcela IS NULL;