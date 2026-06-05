-- Create an RPC function to get the exact size of the Supabase database
CREATE OR REPLACE FUNCTION get_db_size()
RETURNS TABLE (
  database_name text,
  size_bytes bigint,
  size_pretty text
)
LANGUAGE sql
SECURITY DEFINER -- Needs elevated privileges to read pg_database
AS $$
  SELECT 
    datname::text as database_name,
    pg_database_size(datname) as size_bytes,
    pg_size_pretty(pg_database_size(datname)) as size_pretty
  FROM pg_database
  WHERE datname = current_database();
$$;

-- Create an RPC function to get table row counts accurately and fast
CREATE OR REPLACE FUNCTION get_table_counts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  counts json;
BEGIN
  SELECT json_build_object(
    'users', (SELECT count(*) FROM profiles),
    'rooms', (SELECT count(*) FROM rooms),
    'events', (SELECT count(*) FROM events),
    'photos', (SELECT count(*) FROM photos),
    'comments', (SELECT count(*) FROM comments),
    'reactions', (SELECT count(*) FROM reactions)
  ) INTO counts;
  
  RETURN counts;
END;
$$;
