-- Scoped Postgres role for n8n workflow: read + update leads only.
DO $$ BEGIN
  CREATE ROLE n8n_writer WITH LOGIN PASSWORD 'change_me_in_production';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA public TO n8n_writer;
GRANT SELECT, UPDATE ON TABLE public.leads TO n8n_writer;
