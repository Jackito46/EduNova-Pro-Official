SELECT json_agg(t) FROM (
  SELECT proname FROM pg_proc WHERE proname = 'get_my_school_id_text'
) t;
