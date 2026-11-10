-- Script de révocation et suppression de la fonction de sécurité critique exec_sql
-- À exécuter dans le SQL Editor de Supabase pour assainir complètement la base de données.

REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.exec_sql(sql_query text) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.exec_sql(text);
DROP FUNCTION IF EXISTS public.exec_sql(sql_query text);
DROP FUNCTION IF EXISTS public.exec_sql();
