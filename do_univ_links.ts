import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const p_school_id = '3dd425c2-2e23-4e3c-a02a-c67ed85ca490';
  const sql = `
DO $$ 
DECLARE
    v_class_id UUID;
    p_school_id UUID := '${p_school_id}';
BEGIN
    FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND name ILIKE 'Sciences Informatiques%' LOOP
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ALGO101', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MATH-DISC', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ARCHI-ORD', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'INTRO-INFO', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PROG-OOP', 6);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'DBD201', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'RESEAUX1', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'STRUC-DAT', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PROG-WEB', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ING-LOG', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SEC-INF', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SYS-EXPLOIT', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'IA-INTRO', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'CLOUD-ARCH', 4);
    END LOOP;

    FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND name ILIKE 'Génie Software%' LOOP
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ALGO101', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PROG-OOP', 6);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'DBD201', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'STRUC-DAT', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PROG-WEB', 6);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ING-LOG', 6);
    END LOOP;

    FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND (name ILIKE 'Sciences Administratives%' OR name ILIKE 'Sciences Comptables%') LOOP
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'COMP-GEN', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MNG101', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MATH-FIN1', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'COMP-INTER', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MICRO-ECO', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MACRO-ECO', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MNG-RH', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'FIN-CORP', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MARKETING', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'DROIT-AFFAIR', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'STAT-APPL', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'STRAT-ORG', 4);
    END LOOP;

    FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND name ILIKE 'Droit%' LOOP
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'INTRO-DROIT', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'DROIT-CONST', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'HIST-DROIT', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'DROIT-PERS', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'DROIT-OBLIG', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'DROIT-CONST2', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'DROIT-PENAL', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'DROIT-ADMIN', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'DROIT-TRAV', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'DROIT-INT-PUB', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'DROIT-REEL', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PROC-CIV', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PROC-PENAL', 5);
    END LOOP;

    FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND name ILIKE 'Sciences Infirmières%' LOOP
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ANATOMIE1', 6);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ANATOMIE2', 6);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'NUTRITION', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SOINS-FOND', 6);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'MICRO-PARASIT', 4);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PATHOLOGIE1', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'SOINS-ADULTE', 6);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PHARMACO1', 5);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ETHIQUE-DEONT', 3);
    END LOOP;

    FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND name ILIKE 'Médecine Générale%' LOOP
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ANATOMIE1', 8);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ANATOMIE2', 8);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PATHOLOGIE1', 6);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'PHARMACO1', 6);
    END LOOP;

    FOR v_class_id IN SELECT id FROM public.classes WHERE school_id = p_school_id AND level = 'LICENCE' LOOP
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'COM-FR', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'ANG-ACAD', 3);
        PERFORM public.assign_subject_to_class(p_school_id, v_class_id, 'METHOD-RECH', 3);
    END LOOP;

END;
$$;
`;

  const { data, error } = await supabase.rpc('apply_ddl', { v_sql: sql });
  console.log('Execution return:', error);
  console.log('Execution data:', data);
}
main();
