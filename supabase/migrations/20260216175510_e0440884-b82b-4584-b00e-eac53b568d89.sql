-- Fix RLS policy for produtos: remove public access to null user_id rows
DROP POLICY IF EXISTS "Users can view their own produtos" ON public.produtos;
CREATE POLICY "Users can view their own produtos" 
ON public.produtos 
FOR SELECT 
USING (user_id = auth.uid());