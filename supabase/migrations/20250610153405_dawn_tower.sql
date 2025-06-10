/*
  # Correction complète des problèmes d'enregistrement
  
  1. Changes
    - Désactive temporairement RLS sur toutes les tables
    - Supprime toutes les politiques existantes
    - Réactive RLS avec des politiques simplifiées
    - Accorde toutes les permissions nécessaires
    
  2. Security
    - Maintient la sécurité en réactivant RLS avec des politiques appropriées
    - Assure que les administrateurs ont un accès complet
*/

-- Désactiver temporairement RLS sur toutes les tables
ALTER TABLE stores DISABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties DISABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_varieties DISABLE ROW LEVEL SECURITY;
ALTER TABLE store_varieties DISABLE ROW LEVEL SECURITY;
ALTER TABLE store_boxes DISABLE ROW LEVEL SECURITY;

-- Supprimer toutes les politiques existantes
DO $$ 
DECLARE
    tables text[] := ARRAY['stores', 'donut_varieties', 'donut_forms', 'box_configurations', 
                          'box_varieties', 'store_varieties', 'store_boxes'];
    t text;
    r RECORD;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public') 
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, t);
        END LOOP;
    END LOOP;
END $$;

-- Réactiver RLS sur toutes les tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_boxes ENABLE ROW LEVEL SECURITY;

-- Créer des politiques simples et efficaces
-- Stores
CREATE POLICY "stores_admin_policy" ON stores
  FOR ALL TO authenticated
  USING (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  WITH CHECK (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

CREATE POLICY "stores_read_policy" ON stores
  FOR SELECT TO authenticated
  USING (true);

-- Donut Forms
CREATE POLICY "donut_forms_admin_policy" ON donut_forms
  FOR ALL TO authenticated
  USING (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  WITH CHECK (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

CREATE POLICY "donut_forms_read_policy" ON donut_forms
  FOR SELECT TO authenticated
  USING (true);

-- Donut Varieties
CREATE POLICY "donut_varieties_admin_policy" ON donut_varieties
  FOR ALL TO authenticated
  USING (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  WITH CHECK (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

CREATE POLICY "donut_varieties_read_policy" ON donut_varieties
  FOR SELECT TO authenticated
  USING (true);

-- Box Configurations
CREATE POLICY "box_configurations_admin_policy" ON box_configurations
  FOR ALL TO authenticated
  USING (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  WITH CHECK (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

CREATE POLICY "box_configurations_read_policy" ON box_configurations
  FOR SELECT TO authenticated
  USING (true);

-- Box Varieties
CREATE POLICY "box_varieties_admin_policy" ON box_varieties
  FOR ALL TO authenticated
  USING (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  WITH CHECK (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

CREATE POLICY "box_varieties_read_policy" ON box_varieties
  FOR SELECT TO authenticated
  USING (true);

-- Store Varieties
CREATE POLICY "store_varieties_admin_policy" ON store_varieties
  FOR ALL TO authenticated
  USING (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  WITH CHECK (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

CREATE POLICY "store_varieties_read_policy" ON store_varieties
  FOR SELECT TO authenticated
  USING (true);

-- Store Boxes
CREATE POLICY "store_boxes_admin_policy" ON store_boxes
  FOR ALL TO authenticated
  USING (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  WITH CHECK (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

CREATE POLICY "store_boxes_read_policy" ON store_boxes
  FOR SELECT TO authenticated
  USING (true);

-- Accorder toutes les permissions nécessaires
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Vérifier et ajouter les colonnes manquantes
DO $$
BEGIN
  -- Ajouter available_varieties à stores si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'available_varieties'
  ) THEN
    ALTER TABLE stores ADD COLUMN available_varieties text[] DEFAULT '{}';
  END IF;

  -- Ajouter available_boxes à stores si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'available_boxes'
  ) THEN
    ALTER TABLE stores ADD COLUMN available_boxes text[] DEFAULT '{}';
  END IF;
END $$;

-- Mettre à jour les déclencheurs pour updated_at
DO $$
BEGIN
  -- Créer ou remplacer la fonction
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- Recréer les déclencheurs si nécessaire
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_stores_updated_at') THEN
    CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_donut_forms_updated_at') THEN
    CREATE TRIGGER update_donut_forms_updated_at
    BEFORE UPDATE ON donut_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_donut_varieties_updated_at') THEN
    CREATE TRIGGER update_donut_varieties_updated_at
    BEFORE UPDATE ON donut_varieties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_box_configurations_updated_at') THEN
    CREATE TRIGGER update_box_configurations_updated_at
    BEFORE UPDATE ON box_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;