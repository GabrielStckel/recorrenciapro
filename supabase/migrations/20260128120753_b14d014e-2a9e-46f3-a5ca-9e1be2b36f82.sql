-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON public.clientes_parcelados;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clientes_parcelados;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clientes_parcelados;

-- Create restrictive policies that only allow access to own records
CREATE POLICY "Users can view their own clients"
ON public.clientes_parcelados
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
ON public.clientes_parcelados
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients"
ON public.clientes_parcelados
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);