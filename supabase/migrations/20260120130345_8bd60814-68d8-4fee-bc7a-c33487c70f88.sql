-- Criar tabela de produtos/categorias
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Policies para produtos
CREATE POLICY "Authenticated users can view produtos"
ON public.produtos
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert produtos"
ON public.produtos
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update produtos"
ON public.produtos
FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete produtos"
ON public.produtos
FOR DELETE
USING (true);

-- Inserir produtos existentes dos clientes atuais
INSERT INTO public.produtos (nome)
SELECT DISTINCT produto FROM public.clientes_parcelados
WHERE produto IS NOT NULL AND produto != ''
ON CONFLICT (nome) DO NOTHING;