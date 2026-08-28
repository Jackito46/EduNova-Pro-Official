import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
DO $$
DECLARE
    v_school_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
    v_academic_year_id UUID;
    v_class RECORD;
    v_plan RECORD;
    v_student_id UUID;
    i INT;
BEGIN
    -- 1. Ensure Academic Year exists
    SELECT id INTO v_academic_year_id FROM public.academic_years WHERE school_id = v_school_id AND label = '2025-2026';
    
    IF v_academic_year_id IS NULL THEN
        INSERT INTO public.academic_years (school_id, label, is_active, status)
        VALUES (v_school_id, '2025-2026', true, 'ACTIVE')
        RETURNING id INTO v_academic_year_id;
    ELSE
        UPDATE public.academic_years SET is_active = true, status = 'ACTIVE' WHERE id = v_academic_year_id;
    END IF;

    -- 2. Ensure Classes exist (Copy from school-2025-premium if empty)
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE school_id = v_school_id) THEN
        INSERT INTO public.classes (school_id, name, level, teacher_name, room)
        SELECT v_school_id, name, level, teacher_name, room
        FROM public.classes
        WHERE school_id = 'school-2025-premium'
        ON CONFLICT (school_id, name) DO NOTHING;
        
        -- If still empty (no template), create basic ones
        IF NOT EXISTS (SELECT 1 FROM public.classes WHERE school_id = v_school_id) THEN
            INSERT INTO public.classes (school_id, name, level) VALUES 
            (v_school_id, '1ère AF', 'FONDAMENTALE'),
            (v_school_id, '2ème AF', 'FONDAMENTALE'),
            (v_school_id, '3ème AF', 'FONDAMENTALE'),
            (v_school_id, '4ème AF', 'FONDAMENTALE'),
            (v_school_id, '5ème AF', 'FONDAMENTALE'),
            (v_school_id, '6ème AF', 'FONDAMENTALE');
        END IF;
    END IF;

    -- 3. Ensure Fee Plans exist
    INSERT INTO public.fee_plans (school_id, academic_year_id, class_id, inscription_fee, tuition_fee)
    SELECT 
        v_school_id,
        v_academic_year_id,
        c.id,
        CASE 
            WHEN c.level = 'MATERNELLE' THEN 5000
            WHEN c.level = 'FONDAMENTALE' THEN 7500
            WHEN c.level = 'SECONDAIRE' THEN 10000
            ELSE 5000
        END,
        CASE 
            WHEN c.level = 'MATERNELLE' THEN 25000
            WHEN c.level = 'FONDAMENTALE' THEN 35000
            WHEN c.level = 'SECONDAIRE' THEN 50000
            ELSE 20000
        END
    FROM public.classes c
    WHERE c.school_id = v_school_id
    ON CONFLICT (academic_year_id, class_id) DO NOTHING;

    -- 4. CLEANUP: Delete all student-related data for this school
    DELETE FROM public.grades WHERE student_id IN (SELECT id FROM public.students WHERE school_id = v_school_id);
    DELETE FROM public.student_attendances WHERE student_id IN (SELECT id FROM public.students WHERE school_id = v_school_id);
    DELETE FROM public.school_supplies WHERE student_id IN (SELECT id FROM public.students WHERE school_id = v_school_id);
    DELETE FROM public.payments WHERE school_id = v_school_id;
    DELETE FROM public.enrollments WHERE school_id = v_school_id;
    DELETE FROM public.students WHERE school_id = v_school_id;

    -- 5. SEEDING: 50 students per class
    FOR v_class IN SELECT id, name FROM public.classes WHERE school_id = v_school_id LOOP
        
        -- Get fee plan for this class
        SELECT * INTO v_plan FROM public.fee_plans WHERE school_id = v_school_id AND academic_year_id = v_academic_year_id AND class_id = v_class.id LIMIT 1;
        
        FOR i IN 1..50 LOOP
            v_student_id := extensions.uuid_generate_v4();
            
            INSERT INTO public.students (
                id, school_id, class_id, first_name, last_name, gender, dob, status,
                parent_name, parent_relation, parent_phone
            )
            VALUES (
                v_student_id, v_school_id, v_class.id, 
                'Élève' || i, 
                'Test-' || replace(v_class.name, ' ', ''), 
                CASE WHEN i % 2 = 0 THEN 'Féminin' ELSE 'Masculin' END, 
                '2015-01-01', 
                'Actif',
                'Parent ' || i, 'Père', '50900000000'
            );
            
            INSERT INTO public.enrollments (school_id, student_id, academic_year_id, class_id)
            VALUES (v_school_id, v_student_id, v_academic_year_id, v_class.id);
            
            IF v_plan IS NOT NULL AND COALESCE(v_plan.inscription_fee, 0) > 0 THEN
                INSERT INTO public.payments (
                    school_id, student_id, academic_year_id, amount, currency, 
                    fee_type, payment_method, date, status
                )
                VALUES (
                    v_school_id, v_student_id, v_academic_year_id, v_plan.inscription_fee, 'HTG', 
                    'INSCRIPTION', 'Cash', CURRENT_TIMESTAMP, 'VALIDE'
                );
            END IF;
        END LOOP;
    END LOOP;
END $$;
`;

async function run() {
  console.log('Executing full cleanup and seed SQL via RPC...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
    console.error('RPC Error executing SQL:', error);
  } else if (data && data.error) {
    console.error('SQL Error during execution:', data.error);
  } else {
    console.log('Full cleanup and seed SQL executed successfully!', data);
  }
}

run();
