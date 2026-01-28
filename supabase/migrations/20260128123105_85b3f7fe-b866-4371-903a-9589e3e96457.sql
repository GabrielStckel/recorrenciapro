-- Drop existing overly permissive policies on historico_pagamentos
DROP POLICY IF EXISTS "Authenticated users can delete payment history" ON public.historico_pagamentos;
DROP POLICY IF EXISTS "Authenticated users can insert payment history" ON public.historico_pagamentos;
DROP POLICY IF EXISTS "Authenticated users can view payment history" ON public.historico_pagamentos;

-- Create secure policies for historico_pagamentos (linked to client owner)
CREATE POLICY "Users can view their clients payment history" 
ON public.historico_pagamentos 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.clientes_parcelados 
    WHERE clientes_parcelados.id = historico_pagamentos.cliente_id 
    AND clientes_parcelados.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert payment history for their clients" 
ON public.historico_pagamentos 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes_parcelados 
    WHERE clientes_parcelados.id = historico_pagamentos.cliente_id 
    AND clientes_parcelados.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete payment history for their clients" 
ON public.historico_pagamentos 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.clientes_parcelados 
    WHERE clientes_parcelados.id = historico_pagamentos.cliente_id 
    AND clientes_parcelados.user_id = auth.uid()
  )
);

-- Drop existing overly permissive policies on movimentos_parcelas
DROP POLICY IF EXISTS "Authenticated users can delete movements" ON public.movimentos_parcelas;
DROP POLICY IF EXISTS "Authenticated users can insert movements" ON public.movimentos_parcelas;
DROP POLICY IF EXISTS "Authenticated users can view movements" ON public.movimentos_parcelas;

-- Create secure policies for movimentos_parcelas (linked to client owner)
CREATE POLICY "Users can view their clients movements" 
ON public.movimentos_parcelas 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.clientes_parcelados 
    WHERE clientes_parcelados.id = movimentos_parcelas.cliente_id 
    AND clientes_parcelados.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert movements for their clients" 
ON public.movimentos_parcelas 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes_parcelados 
    WHERE clientes_parcelados.id = movimentos_parcelas.cliente_id 
    AND clientes_parcelados.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete movements for their clients" 
ON public.movimentos_parcelas 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.clientes_parcelados 
    WHERE clientes_parcelados.id = movimentos_parcelas.cliente_id 
    AND clientes_parcelados.user_id = auth.uid()
  )
);

-- Add user_id column to produtos for ownership
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS user_id uuid;

-- Drop existing overly permissive policies on produtos
DROP POLICY IF EXISTS "Authenticated users can delete produtos" ON public.produtos;
DROP POLICY IF EXISTS "Authenticated users can insert produtos" ON public.produtos;
DROP POLICY IF EXISTS "Authenticated users can update produtos" ON public.produtos;
DROP POLICY IF EXISTS "Authenticated users can view produtos" ON public.produtos;

-- Create secure policies for produtos (user-owned)
CREATE POLICY "Users can view their own produtos" 
ON public.produtos 
FOR SELECT 
USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert their own produtos" 
ON public.produtos 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own produtos" 
ON public.produtos 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own produtos" 
ON public.produtos 
FOR DELETE 
USING (user_id = auth.uid());