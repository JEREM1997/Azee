/*
  # Désactiver complètement RLS pour permettre l'enregistrement

  1. Changes
    - Désactiver RLS sur toutes les tables
    - Supprimer toutes les politiques RLS
    - Donner accès complet aux utilisateurs authentifiés
    
  2. Security
    - Accès complet pour tous les utilisateurs authentifiés
    - Pas de restrictions basées sur les rôles
*/

-- Désactiver RLS sur toutes les tables
ALTER TABLE stores DISABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties DISABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_varieties DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Supprimer toutes les politiques existantes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Supprimer toutes les politiques sur toutes les tables
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.schemaname || '.' || r.tablename;
    END LOOP;
END $$;

-- Donner tous les privilèges aux utilisateurs authentifiés
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Définir les privilèges par défaut pour les nouvelles tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

-- S'assurer que les colonnes existent dans la table stores
DO $$ 
BEGIN
  -- Ajouter available_varieties si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stores' AND column_name = 'available_varieties'
  ) THEN
    ALTER TABLE stores ADD COLUMN available_varieties text[] DEFAULT '{}';
  END IF;

  -- Ajouter available_boxes si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stores' AND column_name = 'available_boxes'
  ) THEN
    ALTER TABLE stores ADD COLUMN available_boxes text[] DEFAULT '{}';
  END IF;

  -- Ajouter is_active si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stores' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE stores ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  -- Ajouter is_active aux autres tables si elles n'existent pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donut_varieties' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE donut_varieties ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donut_forms' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE donut_forms ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'box_configurations' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE box_configurations ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active);
CREATE INDEX IF NOT EXISTS idx_donut_varieties_active ON donut_varieties(is_active);
CREATE INDEX IF NOT EXISTS idx_donut_forms_active ON donut_forms(is_active);
CREATE INDEX IF NOT EXISTS idx_box_configurations_active ON box_configurations(is_active);