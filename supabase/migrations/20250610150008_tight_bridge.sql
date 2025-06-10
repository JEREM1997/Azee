/*
  # Correction des politiques dupliquées

  1. Changements
    - Suppression sécurisée de toutes les politiques existantes
    - Recréation des politiques avec des noms uniques
    - Utilisation d'une approche idempotente pour éviter les erreurs de duplication
    
  2. Sécurité
    - Maintien des règles RLS existantes
    - Préservation des permissions d'accès
*/

-- Fonction pour supprimer une politique si elle existe
CREATE OR REPLACE FUNCTION drop_policy_if_exists(
  policy_name text,
  table_name text
) RETURNS void AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = table_name 
    AND policyname = policy_name
  ) THEN
    EXECUTE format('DROP POLICY "%s" ON %s', policy_name, table_name);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Supprimer toutes les politiques existantes pour donut_varieties
SELECT drop_policy_if_exists('Allow authenticated users to read donut varieties', 'donut_varieties');
SELECT drop_policy_if_exists('Allow admin users to manage donut varieties', 'donut_varieties');
SELECT drop_policy_if_exists('Admin users have full access to donut varieties', 'donut_varieties');
SELECT drop_policy_if_exists('Authenticated users can read donut varieties', 'donut_varieties');
SELECT drop_policy_if_exists('donut_varieties_read_policy', 'donut_varieties');
SELECT drop_policy_if_exists('donut_varieties_admin_policy', 'donut_varieties');
SELECT drop_policy_if_exists('varieties_admin_access', 'donut_varieties');
SELECT drop_policy_if_exists('varieties_read_access', 'donut_varieties');

-- Créer les nouvelles politiques avec des noms uniques
DO $$ 
BEGIN
  -- Vérifier si la politique existe déjà avant de la créer
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'donut_varieties' 
    AND policyname = 'donut_varieties_read_policy_v1'
  ) THEN
    CREATE POLICY "donut_varieties_read_policy_v1" 
      ON donut_varieties FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'donut_varieties' 
    AND policyname = 'donut_varieties_admin_policy_v1'
  ) THEN
    CREATE POLICY "donut_varieties_admin_policy_v1" 
      ON donut_varieties FOR ALL 
      TO authenticated 
      USING (auth.jwt() ->> 'role' = 'admin') 
      WITH CHECK (auth.jwt() ->> 'role' = 'admin');
  END IF;
END $$;

-- Nettoyer la fonction temporaire
DROP FUNCTION drop_policy_if_exists(text, text);