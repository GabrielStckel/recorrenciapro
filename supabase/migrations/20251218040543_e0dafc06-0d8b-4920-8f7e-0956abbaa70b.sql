-- Create clientes_parcelados table
CREATE TABLE public.clientes_parcelados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cliente_nome TEXT NOT NULL,
  whatsapp TEXT,
  produto TEXT NOT NULL,
  valor_total NUMERIC NOT NULL,
  total_parcelas INTEGER NOT NULL,
  parcelas_pagas INTEGER NOT NULL DEFAULT 0,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_ultimo_pagamento DATE,
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 28),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create historico_pagamentos table
CREATE TABLE public.historico_pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.clientes_parcelados(id) ON DELETE CASCADE NOT NULL,
  data_pagamento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valor_pago NUMERIC NOT NULL,
  numero_parcela INTEGER NOT NULL,
  registrado_por TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.clientes_parcelados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_pagamentos ENABLE ROW LEVEL SECURITY;

-- RLS policies for clientes_parcelados (authenticated users can access all records for team usage)
CREATE POLICY "Authenticated users can view all clients"
  ON public.clientes_parcelados
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert clients"
  ON public.clientes_parcelados
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update clients"
  ON public.clientes_parcelados
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete clients"
  ON public.clientes_parcelados
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS policies for historico_pagamentos (team can access all)
CREATE POLICY "Authenticated users can view payment history"
  ON public.historico_pagamentos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert payment history"
  ON public.historico_pagamentos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete payment history"
  ON public.historico_pagamentos
  FOR DELETE
  TO authenticated
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_clientes_parcelados_updated_at
  BEFORE UPDATE ON public.clientes_parcelados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes_parcelados;
ALTER PUBLICATION supabase_realtime ADD TABLE public.historico_pagamentos;