
CREATE TABLE public.cobrancas_futuras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cliente_nome TEXT NOT NULL,
  whatsapp TEXT,
  valor_a_vista NUMERIC NOT NULL DEFAULT 0,
  data_envio_link DATE NOT NULL,
  link_pagamento TEXT,
  produto TEXT,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cobrancas_futuras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cobrancas"
  ON public.cobrancas_futuras FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cobrancas"
  ON public.cobrancas_futuras FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cobrancas"
  ON public.cobrancas_futuras FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cobrancas"
  ON public.cobrancas_futuras FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_cobrancas_futuras_updated_at
  BEFORE UPDATE ON public.cobrancas_futuras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
