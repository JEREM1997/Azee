-- Supprimer la policy existante si elle existe déjà
DO $$ 
BEGIN
  -- Vérifier si la policy existe avant de tenter de la supprimer
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'donut_varieties' 
    AND policyname = 'Allow authenticated users to read donut varieties'
  ) THEN
    DROP POLICY "Allow authenticated users to read donut varieties" ON donut_varieties;
  END IF;
END $$;

-- Créer la policy seulement si elle n'existe pas déjà
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'donut_varieties' 
    AND policyname = 'Allow authenticated users to read donut varieties'
  ) THEN
    CREATE POLICY "Allow authenticated users to read donut varieties" 
      ON donut_varieties 
      FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;
END $$;