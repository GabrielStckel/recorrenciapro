ALTER TABLE public.clientes_parcelados 
ADD COLUMN valor_pago_parcial numeric DEFAULT NULL,
ADD COLUMN observacao_revisao text DEFAULT NULL;