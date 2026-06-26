-- Ejecutar este script en el SQL Editor de Supabase antes de correr import_data.py
-- URL: https://supabase.com/dashboard/project/smeqmbgnsvdssewkvgzr/sql

-- Permitir que la anon key pueda insertar datos (necesario para el script de importación)
CREATE POLICY "import_insert_obras"
  ON obras
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "import_insert_partidas"
  ON partidas
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "import_insert_registros"
  ON registros
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Verificar que las políticas existen
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('obras', 'partidas', 'registros');
