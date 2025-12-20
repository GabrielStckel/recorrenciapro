-- Add review fields to clientes_parcelados
ALTER TABLE public.clientes_parcelados
ADD COLUMN em_revisao boolean NOT NULL DEFAULT false,
ADD COLUMN mes_referencia_revisao text;