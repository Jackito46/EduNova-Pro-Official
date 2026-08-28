
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const schoolId = 'a89520ab-3894-49d4-86d8-1421e3012f58'; // Collège Christ VIVANT

async function seed() {
  console.log('--- ETAPE -1: PURGE DES ANCIENS ELEVES DE L\'ECOLE ---');
  await supabase.rpc('exec_ddl', { ddl_query: `DELETE FROM public.students WHERE school_id = '${schoolId}'` });
  console.log('Anciens élèves supprimés via CASCADE (inscriptions, paiements).');

  console.log('--- ETAPE 0: DÉPLOIEMENT DE EXEC_CUSTOM VIA EXEC_DDL ---');
  const createCustomSql = `
    CREATE OR REPLACE FUNCTION public.exec_custom(sql_query text)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    DECLARE
        result jsonb;
    BEGIN
        IF sql_query ILIKE 'INSERT%' OR sql_query ILIKE 'UPDATE%' OR sql_query ILIKE 'WITH%' THEN
            EXECUTE format('WITH t AS (%s) SELECT json_agg(t) FROM t', TRIM(TRAILING ';' FROM sql_query)) INTO result;
        ELSE
            EXECUTE format('SELECT json_agg(t) FROM (%s) t', TRIM(TRAILING ';' FROM sql_query)) INTO result;
        END IF;
        RETURN COALESCE(result, '[]'::jsonb);
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('status', 'error', 'message', SQLERRM, 'detail', SQLSTATE);
    END;
    $func$;
  `;
  await supabase.rpc('exec_ddl', { ddl_query: createCustomSql });

  console.log('--- ETAPE 1: RÉCUPÉRATION DES CLASSES ---');
  const { data: classes, error: cError } = await supabase.rpc('exec_sql', { 
    sql_query: `SELECT id, name, level FROM public.classes WHERE school_id = '${schoolId}'` 
  });

  if (cError || !classes) {
    console.error('Error fetching classes:', cError);
    return;
  }
  console.log(`Trouvé ${classes.length} classes.`);

  console.log('--- ETAPE 2: RÉCUPÉRATION DE L\'ANNÉE ACADÉMIQUE ACTIVE ---');
  const { data: years, error: yError } = await supabase.rpc('exec_sql', { 
    sql_query: `SELECT id, label FROM public.academic_years WHERE school_id = '${schoolId}' AND is_active = true LIMIT 1`
  });

  if (yError || !years || years.length === 0) {
     console.error('No active academic year found for this school.');
     return;
  }
  const yearId = years[0].id;
  console.log(`Année active: ${years[0].label} (${yearId})`);

  console.log('--- ETAPE 3: RÉCUPÉRATION DES FRAIS D\'INSCRIPTION ---');
  const { data: plans, error: pError } = await supabase.rpc('exec_sql', { 
    sql_query: `SELECT class_id, inscription_fee, inscription_fee_usd FROM public.fee_plans WHERE academic_year_id = '${yearId}'`
  });

  const lastNames = ['Jean', 'Pierre', 'Lefebvre', 'Joseph', 'Altidor', 'Baptiste', 'Charles', 'Dervil', 'Etienne', 'Francois', 'Guerrier', 'Honorat', 'Isidor', 'Julien', 'Kernizan', 'Louis', 'Mertilus', 'Noel', 'Octave', 'Philippe', 'Querech', 'Regis', 'Saint-Jean', 'Toussaint', 'Valentin', 'Zidor'];
  const firstNamesM = ['Samuel', 'Jean-Paul', 'Junior', 'Daniel', 'Woody', 'Peterson', 'Ricardo', 'Mackenson', 'Davidson', 'Stevenson', 'Emmanuel', 'Stanley', 'Evens', 'Gregory', 'Clifford'];
  const firstNamesF = ['Marie', 'Sarah', 'Ketia', 'Love', 'Rose', 'Vanessa', 'Christelle', 'Esther', 'Ruth', 'Naika', 'Nathalie', 'Syntia', 'Mirlene', 'Daphney', 'Clara'];

  const getRandomElement = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

  for (const cls of (classes as any[])) {
    const isMaternelle = cls.level === 'MATERNELLE';
    const targetCount = isMaternelle ? 10 : 15;
    
    const n = cls.name.toUpperCase();
    let baseAge = 6;
    let valid = false;
    if (n.includes('PETITE')) { baseAge = 3; valid = true; }
    else if (n.includes('MOYENNE')) { baseAge = 4; valid = true; }
    else if (n.includes('GRANDE')) { baseAge = 5; valid = true; }
    else if (n.includes('1ERE') || n.includes('1ÈRE') || n.includes('1ERE AF')) { baseAge = 6; valid = true; }
    else if (n.includes('2EME') || n.includes('2ÈME')) { baseAge = 7; valid = true; }
    else if (n.includes('3EME') || n.includes('3ÈME')) { baseAge = 8; valid = true; }
    else if (n.includes('4EME') || n.includes('4ÈME')) { baseAge = 9; valid = true; }
    else if (n.includes('5EME') || n.includes('5ÈME')) { baseAge = 10; valid = true; }
    else if (n.includes('6EME') || n.includes('6ÈME')) { baseAge = 11; valid = true; }
    else if (n.includes('7EME') || n.includes('7ÈME')) { baseAge = 12; valid = true; }
    else if (n.includes('8EME') || n.includes('8ÈME')) { baseAge = 13; valid = true; }
    else if (n.includes('9EME') || n.includes('9ÈME')) { baseAge = 14; valid = true; }
    else if (n.includes('NS I') || n.includes('NS 1') || n.includes('NSI')) { baseAge = 15; valid = true; }
    else if (n.includes('NS II') || n.includes('NS 2') || n.includes('NSII')) { baseAge = 16; valid = true; }
    else if (n.includes('NS III') || n.includes('NS 3') || n.includes('NSIII')) { baseAge = 17; valid = true; }
    else if (n.includes('NS IV') || n.includes('NS 4') || n.includes('NSIV')) { baseAge = 18; valid = true; }

    if (!valid) continue;

    console.log(`Traitement de la classe ${cls.name} (${cls.level}) - Cible: ${targetCount} élèves.`);

    const plan = (plans as any[])?.find(p => p.class_id === cls.id);
    const htgFee = plan?.inscription_fee || 1500;
    const usdFee = plan?.inscription_fee_usd || 0;

    for (let i = 0; i < targetCount; i++) {
        const genderCode = Math.random() > 0.5 ? 'M' : 'F';
        const genderValue = genderCode === 'M' ? 'Masculin' : 'Féminin';
        const firstName = genderCode === 'M' ? getRandomElement(firstNamesM) : getRandomElement(firstNamesF);
        const lastName = getRandomElement(lastNames);
        
        const ageOffset = Math.random() > 0.8 ? (Math.random() > 0.5 ? 2 : 1) : 0;
        const currentYearNum = 2024;
        const birthYear = currentYearNum - (baseAge + ageOffset);
        const dob = `${birthYear}-${Math.floor(Math.random() * 12 + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 28 + 1).toString().padStart(2, '0')}`;

        // 1. Create Student
        const parentRel = Math.random() > 0.5 ? 'Père' : 'Mère';
        const studentSql = `INSERT INTO public.students (school_id, class_id, first_name, last_name, gender, dob, status, address, parent_name, parent_phone, parent_relation) VALUES ('${schoolId}', '${cls.id}', '${firstName.replace("'", "''")}', '${lastName.replace("'", "''")}', '${genderValue}', '${dob}', 'Actif', 'Port-au-Prince, Haïti', '${lastName.replace("'", "''")} Parent', '509${Math.floor(Math.random() * 90000000 + 10000000)}', '${parentRel}') RETURNING id`;
        
        const { data: sData, error: sErr } = await supabase.rpc('exec_custom', { sql_query: studentSql });

        if (sErr || (sData && (sData.error || sData.status === 'error'))) {
            console.error('Error creating student:', sErr || sData);
            continue;
        }

        const studentId = sData?.[0]?.id;
        if (!studentId) {
            console.error('Could not find student ID in results:', sData);
            continue;
        }

        // 2. Create Enrollment
        const { data: eData, error: eError } = await supabase.rpc('exec_custom', { sql_query: `INSERT INTO public.enrollments (school_id, student_id, academic_year_id, class_id, status) VALUES ('${schoolId}', '${studentId}', '${yearId}', '${cls.id}', 'ACTIVE') RETURNING id` });
        if (eError || (eData && (eData.error || eData.status === 'error'))) {
            console.error('Error creating enrollment:', eError || eData);
        }

        // 3. Create Payment (if needed)
        if (htgFee > 0 || usdFee > 0) {
            const paySql = `INSERT INTO public.payments (school_id, student_id, academic_year_id, amount, currency, fee_type, type, nature, method, payment_method, status, date, amount_htg_equivalent) VALUES ('${schoolId}', '${studentId}', '${yearId}', ${htgFee > 0 ? htgFee : usdFee}, '${htgFee > 0 ? 'HTG' : 'USD'}', 'INSCRIPTION', 'Revenu', 'RECOUVREMENT', 'Cash', 'Cash', 'VALIDE', CURRENT_DATE, ${htgFee > 0 ? htgFee : usdFee}) RETURNING id`;
            const { data: pData, error: pError } = await supabase.rpc('exec_custom', { sql_query: paySql });
            if (pError || (pData && pData.status === 'error')) console.error("Payment insert error (Inscription):", pError || pData);
        }
    }
    console.log(`Inscrit ${targetCount} élèves en ${cls.name}.`);
  }
  console.log('--- OPÉRATION TERMINÉE ---');
}

seed();
