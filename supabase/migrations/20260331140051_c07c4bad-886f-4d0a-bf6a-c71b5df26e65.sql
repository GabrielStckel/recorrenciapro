
-- Touch all existing records so updated_at reflects current time
UPDATE public.clientes_parcelados SET updated_at = now();
