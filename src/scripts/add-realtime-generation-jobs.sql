-- Adiciona a tabela generation_jobs à publicação supabase_realtime para os
-- estados de geração (QUEUED → RUNNING → COMPLETED/FAILED) chegarem ao browser
-- via Supabase Realtime (postgres_changes).
--
-- Pré-requisito por ambiente: correr este script no SQL editor do Supabase
-- (hosteado) e em qualquer Supabase local (supabase start) que a app use.
-- É idempotente — pode correr várias vezes.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'generation_jobs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_jobs;
    END IF;
END $$;