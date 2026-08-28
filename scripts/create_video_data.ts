import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''; // If this is service key, great. Otherwise we use signup

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  // 1. Create User
  console.log("Creating user demo@edunovapro.ht...");
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'demo@edunovapro.ht',
    password: 'DemoPassword2026!',
    options: {
      data: {
        full_name: 'Directeur EduNova'
      }
    }
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
         console.log("User already exists. Logging in...");
         await supabase.auth.signInWithPassword({
            email: 'demo@edunovapro.ht',
            password: 'DemoPassword2026!'
         });
    } else {
        console.error("Auth error:", authError);
        return;
    }
  }

  // Use the admin JWT token to insert data? No, if we're signed in, we can just insert as normal user because RLS will handle it properly if we create our own things.
  // Wait, signUp might return a session if email confirmations are disabled. Let's check.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
      // login
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: 'demo@edunovapro.ht',
          password: 'DemoPassword2026!'
      });
      if (loginError) {
          console.error("Login error (email confirmation might be required):", loginError);
          // Fallback to exec_sql
      }
  }

  // We can just use exec_sql since we have access to it!
  console.log("Using exec_sql to inject amazing demo data...");

  const sql = `
  DO $$
  DECLARE
      v_user_id uuid;
      v_school_id uuid;
      v_year_id uuid;
      v_class_ids uuid[] := '{}';
      v_student_ids uuid[] := '{}';
      v_fee_plan_ids uuid[] := '{}';
      names text[] := ARRAY['Jean', 'Marie', 'Paul', 'Jacques', 'Michel', 'Pierre', 'Claude', 'Anne', 'Robert', 'Louis', 'Julie', 'Sophie', 'Luc', 'Marc'];
      lastnames text[] := ARRAY['Saint-Lot', 'Pierre', 'Charles', 'Dorsainvil', 'Antoine', 'Joseph', 'Noel', 'Francois', 'Auguste', 'Toussaint', 'Baptiste', 'Guillaume', 'Bastien'];
      i int;
      j int;
      v_class_id uuid;
      v_student_id uuid;
      random_date date;
  BEGIN
      -- Create specific school
      v_school_id := gen_random_uuid();
      
      INSERT INTO schools (id, name, director_name, phone, address, email, is_protected, subscription_plan)
      VALUES (v_school_id, 'Collège d''Excellence EduNova', 'Dr. J. Edouard', '+509 3444-2020', 'Pétion-Ville, Route de Kenscoff', 'contact@edunova.ht', false, 'unlimited');

      -- Get or create user
      SELECT id INTO v_user_id FROM auth.users WHERE email = 'demo@edunovapro.ht';
      IF v_user_id IS NULL THEN
        -- We can't insert into auth.users directly easily due to password hashes, so we assume the JS created it.
        -- But if JS failed due to email confirmation, we manually insert a dummy one!
        -- Actually we can insert directly:
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
        VALUES ('00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', 'demo@edunovapro.ht', crypt('DemoPassword2026!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Directeur EduNova"}', now(), now(), '', '', '', '');
      END IF;

      -- Profile
      INSERT INTO profiles (id, email, full_name, role, school_id)
      VALUES (v_user_id, 'demo@edunovapro.ht', 'Directeur EduNova', 'SUPER_ADMIN', v_school_id)
      ON CONFLICT (id) DO UPDATE SET school_id = v_school_id, role = 'SUPER_ADMIN';

      -- Academic Year
      v_year_id := gen_random_uuid();
      INSERT INTO academic_years (id, school_id, label, start_date, end_date, status)
      VALUES (v_year_id, v_school_id, '2025-2026', '2025-09-01', '2026-07-01', 'ACTIVE');

      -- Classes
      FOR i IN 1..7 LOOP
          v_class_id := gen_random_uuid();
          INSERT INTO classes (id, school_id, name, level)
          VALUES (v_class_id, v_school_id, 
            CASE i 
              WHEN 1 THEN '1ère Année Fondamentale'
              WHEN 2 THEN '2ème Année Fondamentale'
              WHEN 3 THEN '7ème Année Fondamentale'
              WHEN 4 THEN '9ème Année Fondamentale'
              WHEN 5 THEN 'Nouveau Secondaire 1 (NS1)'
              WHEN 6 THEN 'Nouveau Secondaire 3 (NS3)'
              WHEN 7 THEN 'Nouveau Secondaire 4 (NS4)'
            END,
            CASE WHEN i <= 4 THEN 'FONDAMENTALE' ELSE 'SECONDAIRE' END
          );
          v_class_ids := array_append(v_class_ids, v_class_id);
          
          -- Base Fee plan for class
          INSERT INTO fee_plans (id, school_id, academic_year_id, target_type, target_id, title, amount, currency, frequency, is_mandatory, due_date)
          VALUES (
             gen_random_uuid(), v_school_id, v_year_id, 'CLASS', v_class_id, 'Scolarité Annuelle', 75000 + (i * 10000), 'HTG', 'YEARLY', true, '2025-09-01'
          );
          INSERT INTO fee_plans (id, school_id, academic_year_id, target_type, target_id, title, amount, currency, frequency, is_mandatory, due_date)
          VALUES (
             gen_random_uuid(), v_school_id, v_year_id, 'CLASS', v_class_id, 'Frais Inscription', 15000, 'HTG', 'ONCE', true, '2025-08-01'
          );
          INSERT INTO fee_plans (id, school_id, academic_year_id, target_type, target_id, title, amount, currency, frequency, is_mandatory, due_date)
          VALUES (
             gen_random_uuid(), v_school_id, v_year_id, 'CLASS', v_class_id, 'Frais Informatique', 150, 'USD', 'YEARLY', true, '2025-10-01'
          );
      END LOOP;

      -- Students
      FOR i IN 1..180 LOOP
          v_student_id := gen_random_uuid();
          INSERT INTO students (id, school_id, first_name, last_name, gender, status, admission_date)
          VALUES (v_student_id, v_school_id, 
            names[1 + mod(i, array_length(names, 1))],
            lastnames[1 + mod(i + i/2, array_length(lastnames, 1))],
            CASE WHEN mod(i, 2) = 0 THEN 'Féminin' ELSE 'Masculin' END,
            'Actif',
            '2025-08-15'
          );
          v_student_ids := array_append(v_student_ids, v_student_id);

          -- Enrollment
          v_class_id := v_class_ids[1 + mod(i, array_length(v_class_ids, 1))];
          INSERT INTO enrollments (id, school_id, student_id, academic_year_id, class_id)
          VALUES (gen_random_uuid(), v_school_id, v_student_id, v_year_id, v_class_id);
      END LOOP;

      -- Generous Payments over the last 9 months
      FOR i IN 1..600 LOOP
          v_student_id := v_student_ids[1 + mod(abs(md5(i::text)::int), array_length(v_student_ids, 1))];
          -- Random date between Sep 2025 and May 2026
          random_date := '2025-09-01'::date + (random() * 250)::int;
          
          INSERT INTO payments (id, school_id, student_id, academic_year_id, amount, currency, type, payment_method, status, created_at, created_by)
          VALUES (
             gen_random_uuid(), v_school_id, v_student_id, v_year_id,
             (random() * 25000 + 5000)::int,
             CASE WHEN random() > 0.8 THEN 'USD' ELSE 'HTG' END,
             CASE WHEN random() > 0.7 THEN 'INSCRIPTION' WHEN random() > 0.5 THEN 'INFORMATIQUE' ELSE 'SCOLARITÉ' END,
             CASE WHEN random() > 0.8 THEN 'MonCash' WHEN random() > 0.6 THEN 'Chèque' ELSE 'Cash' END,
             'VALIDE',
             random_date,
             v_user_id
          );
      END LOOP;

      -- Some Expenses
      FOR i IN 1..150 LOOP
          random_date := '2025-09-01'::date + (random() * 250)::int;
          INSERT INTO expenses (id, school_id, academic_year_id, category, description, amount, currency, created_at, created_by)
          VALUES (
             gen_random_uuid(), v_school_id, v_year_id,
             CASE WHEN random() > 0.7 THEN 'Salaires' WHEN random() > 0.4 THEN 'Maintenance' ELSE 'Électricité' END,
             'Dépense de fonctionnement',
             (random() * 50000 + 10000)::int,
             CASE WHEN random() > 0.9 THEN 'USD' ELSE 'HTG' END,
             random_date,
             v_user_id
          );
      END LOOP;

  END $$;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
      console.error("Error executing SQL:", error);
  } else {
      console.log("Amazing Demo Account created successfully!");
      console.log("Email: demo@edunovapro.ht");
      console.log("Password: DemoPassword2026!");
  }

}

run();
