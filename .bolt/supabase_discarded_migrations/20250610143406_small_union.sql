/*
  # Création sécurisée des politiques RLS

  1. Changements
    - Vérification de l'existence des politiques avant création
    - Création conditionnelle des politiques manquantes
    - Évite les erreurs de duplication
    
  2. Sécurité
    - Maintient la sécurité RLS sur toutes les tables
    - Les utilisateurs admin ont un accès complet
    - Tous les utilisateurs authentifiés ont un accès en lecture
*/

-- Fonction pour créer une politique seulement si elle n'existe pas
CREATE OR REPLACE FUNCTION create_policy_if_not_exists(
  policy_name text,
  table_name text,
  policy_definition text
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = table_name 
    AND policyname = policy_name
  ) THEN
    EXECUTE policy_definition;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- S'assurer que RLS est activé sur toutes les tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_varieties ENABLE ROW LEVEL SECURITY;

-- Créer les politiques pour la table stores
SELECT create_policy_if_not_exists(
  'Allow authenticated users to read stores',
  'stores',
  'CREATE POLICY "Allow authenticated users to read stores" ON stores FOR SELECT TO authenticated USING (true);'
);

SELECT create_policy_if_not_exists(
  'Allow admin users to manage stores',
  'stores',
  'CREATE POLICY "Allow admin users to manage stores" ON stores FOR ALL TO authenticated USING (auth.jwt() ->> ''role'' = ''admin'') WITH CHECK (auth.jwt() ->> ''role'' = ''admin'');'
);

-- Créer les politiques pour la table donut_varieties
SELECT create_policy_if_not_exists(
  'Allow authenticated users to read donut varieties',
  'donut_varieties',
  'CREATE POLICY "Allow authenticated users to read donut varieties" ON donut_varieties FOR SELECT TO authenticated USING (true);'
);

SELECT create_policy_if_not_exists(
  'Allow admin users to manage donut varieties',
  'donut_varieties',
  'CREATE POLICY "Allow admin users to manage donut varieties" ON donut_varieties FOR ALL TO authenticated USING (auth.jwt() ->> ''role'' = ''admin'') WITH CHECK (auth.jwt() ->> ''role'' = ''admin'');'
);

-- Créer les politiques pour la table donut_forms
SELECT create_policy_if_not_exists(
  'Allow authenticated users to read donut forms',
  'donut_forms',
  'CREATE POLICY "Allow authenticated users to read donut forms" ON donut_forms FOR SELECT TO authenticated USING (true);'
);

SELECT create_policy_if_not_exists(
  'Allow admin users to manage donut forms',
  'donut_forms',
  'CREATE POLICY "Allow admin users to manage donut forms" ON donut_forms FOR ALL TO authenticated USING (auth.jwt() ->> ''role'' = ''admin'') WITH CHECK (auth.jwt() ->> ''role'' = ''admin'');'
);

-- Créer les politiques pour la table box_configurations
SELECT create_policy_if_not_exists(
  'Allow authenticated users to read box configurations',
  'box_configurations',
  'CREATE POLICY "Allow authenticated users to read box configurations" ON box_configurations FOR SELECT TO authenticated USING (true);'
);

SELECT create_policy_if_not_exists(
  'Allow admin users to manage box configurations',
  'box_configurations',
  'CREATE POLICY "Allow admin users to manage box configurations" ON box_configurations FOR ALL TO authenticated USING (auth.jwt() ->> ''role'' = ''admin'') WITH CHECK (auth.jwt() ->> ''role'' = ''admin'');'
);

-- Créer les politiques pour la table box_varieties
SELECT create_policy_if_not_exists(
  'Allow authenticated users to read box varieties',
  'box_varieties',
  'CREATE POLICY "Allow authenticated users to read box varieties" ON box_varieties FOR SELECT TO authenticated USING (true);'
);

SELECT create_policy_if_not_exists(
  'Allow admin users to manage box varieties',
  'box_varieties',
  'CREATE POLICY "Allow admin users to manage box varieties" ON box_varieties FOR ALL TO authenticated USING (auth.jwt() ->> ''role'' = ''admin'') WITH CHECK (auth.jwt() ->> ''role'' = ''admin'');'
);

-- Nettoyer la fonction temporaire
DROP FUNCTION create_policy_if_not_exists(text, text, text);