-- Add status_cliente column to clientes_parcelados
ALTER TABLE public.clientes_parcelados
ADD COLUMN status_cliente TEXT NOT NULL DEFAULT 'ATIVO'
CHECK (status_cliente IN ('ATIVO', 'PAUSADO', 'CANCELADO', 'QUITADO'));