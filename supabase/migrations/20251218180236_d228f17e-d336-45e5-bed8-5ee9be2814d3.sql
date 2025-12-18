-- Remove a constraint atual que limita 1-28
ALTER TABLE public.clientes_parcelados DROP CONSTRAINT IF EXISTS clientes_parcelados_dia_vencimento_check;

-- Criar nova constraint permitindo 1-31
ALTER TABLE public.clientes_parcelados ADD CONSTRAINT clientes_parcelados_dia_vencimento_check CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31);