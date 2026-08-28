CREATE EXTENSION IF NOT EXISTS unaccent;

DROP FUNCTION IF EXISTS public.search_students_accent_insensitive(UUID, TEXT, INT);

CREATE OR REPLACE FUNCTION public.search_students_accent_insensitive(
    p_school_id UUID,
    p_query TEXT,
    p_limit INT DEFAULT 15
)
RETURNS TABLE (
    id UUID,
    first_name TEXT,
    last_name TEXT,
    class_name TEXT,
    class_id UUID,
    discount_amount NUMERIC,
    birth_date DATE,
    birth_place TEXT,
    gender TEXT
) AS $$
DECLARE
    v_query TEXT;
BEGIN
    v_query := public.unaccent(trim(p_query));
    RETURN QUERY
    SELECT 
        s.id,
        s.first_name,
        s.last_name,
        c.name as class_name,
        s.class_id,
        s.discount_amount,
        s.dob as birth_date,
        s.pob as birth_place,
        s.gender
    FROM public.students s
    LEFT JOIN public.classes c ON s.class_id = c.id
    WHERE s.school_id = p_school_id
    AND (
        public.unaccent(s.first_name) ILIKE '%' || v_query || '%'
        OR 
        public.unaccent(s.last_name) ILIKE '%' || v_query || '%'
        OR
        public.unaccent(s.first_name || ' ' || s.last_name) ILIKE '%' || v_query || '%'
        OR
        s.id::text ILIKE '%' || p_query || '%'
    )
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
