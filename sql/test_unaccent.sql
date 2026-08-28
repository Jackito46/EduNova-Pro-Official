SELECT unaccent('Léa') as test_unaccent;
SELECT * FROM public.students WHERE unaccent(first_name) ILIKE unaccent('%Lea%') OR unaccent(last_name) ILIKE unaccent('%Lea%');
