SELECT json_agg(t) FROM (
  SELECT id, name FROM public.schools 
  WHERE id::text = 'a0ed9087-0554-40ae-ac26-86599a183b16'
) t;
