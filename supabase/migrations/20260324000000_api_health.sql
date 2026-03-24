-- Health check RPC callable from any client
-- Usage: SELECT api_health();
-- Or via supabase.rpc('api_health')
CREATE OR REPLACE FUNCTION api_health()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'status', 'ok',
    'ts',     now(),
    'db',     current_database()
  );
$$;

-- Grant to anon and authenticated roles
GRANT EXECUTE ON FUNCTION api_health() TO anon, authenticated;
