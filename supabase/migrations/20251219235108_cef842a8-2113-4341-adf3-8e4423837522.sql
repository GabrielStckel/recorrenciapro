-- Create table for tracking installment movements
CREATE TABLE public.movimentos_parcelas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes_parcelados(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('INCREMENTO', 'DECREMENTO', 'AJUSTE')),
  delta_parcelas INTEGER NOT NULL,
  parcelas_antes INTEGER NOT NULL,
  parcelas_depois INTEGER NOT NULL,
  observacao TEXT,
  data_evento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.movimentos_parcelas ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view movements"
ON public.movimentos_parcelas
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert movements"
ON public.movimentos_parcelas
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete movements"
ON public.movimentos_parcelas
FOR DELETE
USING (true);

-- Create index for faster queries
CREATE INDEX idx_movimentos_parcelas_cliente_id ON public.movimentos_parcelas(cliente_id);
CREATE INDEX idx_movimentos_parcelas_data_evento ON public.movimentos_parcelas(data_evento DESC);