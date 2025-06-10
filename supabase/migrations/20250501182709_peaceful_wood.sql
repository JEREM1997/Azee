/*
  # Enable RLS and create policies for table_name
  
  1. Security Changes
    - Enable RLS on table_name
    - Add policy for admin access
    - Add policy for user access with proper type casting
*/

-- Enable RLS
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins have full access"
  ON public.table_name
  FOR ALL 
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can view their own data"
  ON public.table_name
  FOR SELECT
  TO authenticated
  USING ((auth.uid())::text::bigint = id);