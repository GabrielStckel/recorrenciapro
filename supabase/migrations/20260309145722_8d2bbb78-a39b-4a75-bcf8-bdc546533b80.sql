-- Table to link clients between partner accounts
CREATE TABLE public.clientes_vinculados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes_parcelados(id) ON DELETE CASCADE,
  cliente_parceiro_id uuid NOT NULL REFERENCES public.clientes_parcelados(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parceiro_user_id uuid NOT NULL,
  percentual_user numeric NOT NULL,
  percentual_parceiro numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, cliente_parceiro_id)
);

ALTER TABLE public.clientes_vinculados ENABLE ROW LEVEL SECURITY;

-- Users can see links where they are either the owner or the partner
CREATE POLICY "Users can view their links"
ON public.clientes_vinculados
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = parceiro_user_id);

-- Users can insert links for their own clients
CREATE POLICY "Users can insert links"
ON public.clientes_vinculados
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can delete links they created
CREATE POLICY "Users can delete their links"
ON public.clientes_vinculados
FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = parceiro_user_id);