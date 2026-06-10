-- Portable uuidv7() for PostgreSQL 13–17.
-- PostgreSQL 18 ships uuidv7() natively (in pg_catalog); there we skip and use it.
-- On PG13–17 (Yandex Managed PostgreSQL, most VPS installs) we install an
-- RFC 9562 v7-compatible function so the schema's `DEFAULT uuidv7()` works everywhere.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'uuidv7' AND pronargs = 0) THEN
    CREATE FUNCTION public.uuidv7() RETURNS uuid
    LANGUAGE sql VOLATILE
    AS $fn$
      SELECT encode(
        set_bit(
          set_bit(
            overlay(uuid_send(gen_random_uuid())
              PLACING substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
              FROM 1 FOR 6),
            52, 1),
          53, 1),
        'hex')::uuid;
    $fn$;
  END IF;
END
$$;
