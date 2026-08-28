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

const SCHOOL_ID = 'a0ed9087-0554-40ae-ac26-86599a183b16';
const STUDENTS_PER_CLASS = 50;

async function seed() {
  console.log(`Starting seed for school: ${SCHOOL_ID}`);

  const { data: schools } = await supabase.from('schools').select('*');
  console.log("Schools:", schools);

  const { data: allYears } = await supabase.from('academic_years').select('*');
  console.log("All academic years in DB:", allYears);

  // 1. Fetch active academic year
  const { data: years, error: yearError } = await supabase
    .from('academic_years')
    .select('*')
    .eq('school_id', SCHOOL_ID);
    
  console.log("All years:", years);

  if (yearError || !years || years.length === 0) {
    console.error('No academic year found.', yearError);
    return;
  }
  const activeYear = years.find(y => y.status === 'ACTIVE' || y.is_active === true) || years[0];
  console.log(`Active year: ${activeYear.label} (${activeYear.id})`);

  // 2. Fetch classes
  const { data: classes, error: classError } = await supabase
    .from('classes')
    .select('*')
    .eq('school_id', SCHOOL_ID);

  if (classError || !classes || classes.length === 0) {
    console.error('No classes found.', classError);
    return;
  }
  console.log(`Found ${classes.length} classes.`);

  // 3. Fetch tuition plans
  const { data: plans, error: planError } = await supabase
    .from('tuition_plans')
    .select('*')
    .eq('school_id', SCHOOL_ID)
    .eq('academic_year_id', activeYear.id);

  if (planError) {
    console.error('Error fetching plans.', planError);
    return;
  }

  // 4. Delete existing students for this school
  console.log('Deleting existing students...');
  const { error: deleteError } = await supabase
    .from('students')
    .delete()
    .eq('school_id', SCHOOL_ID);

  if (deleteError) {
    console.error('Error deleting students.', deleteError);
    return;
  }
  console.log('Existing students deleted.');

  // 5. Generate and insert new students
  let totalInserted = 0;
  for (const cls of classes) {
    console.log(`Processing class: ${cls.name}`);
    const plan = plans?.find(p => p.class_id === cls.id);
    const inscriptionFee = plan ? Number(plan.inscription_fee || 0) : 0;

    const newStudents = [];
    for (let i = 1; i <= STUDENTS_PER_CLASS; i++) {
      newStudents.push({
        school_id: SCHOOL_ID,
        class_id: cls.id,
        first_name: `Élève${i}`,
        last_name: `Test-${cls.name.replace(/\s+/g, '')}`,
        gender: i % 2 === 0 ? 'Féminin' : 'Masculin',
        dob: '2015-01-01',
        status: 'Actif'
      });
    }

    // Insert students
    const { data: insertedStudents, error: insertError } = await supabase
      .from('students')
      .insert(newStudents)
      .select('id');

    if (insertError || !insertedStudents) {
      console.error(`Error inserting students for class ${cls.name}`, insertError);
      continue;
    }

    // Insert enrollments
    const enrollments = insertedStudents.map(s => ({
      school_id: SCHOOL_ID,
      student_id: s.id,
      academic_year_id: activeYear.id,
      class_id: cls.id,
      enrollment_date: new Date().toISOString().split('T')[0],
      status: 'ACTIVE'
    }));

    const { error: enrollError } = await supabase
      .from('enrollments')
      .insert(enrollments);

    if (enrollError) {
      console.error(`Error enrolling students for class ${cls.name}`, enrollError);
    }

    // Insert payments (Inscription)
    if (inscriptionFee > 0) {
      const payments = insertedStudents.map(s => ({
        school_id: SCHOOL_ID,
        student_id: s.id,
        academic_year_id: activeYear.id,
        amount: inscriptionFee,
        currency: 'HTG',
        fee_type: 'INSCRIPTION',
        payment_method: 'Cash',
        payment_date: new Date().toISOString(),
        status: 'COMPLETED',
        recorded_by: null // System
      }));

      const { error: payError } = await supabase
        .from('payments')
        .insert(payments);

      if (payError) {
        console.error(`Error inserting payments for class ${cls.name}`, payError);
      }
    }

    totalInserted += insertedStudents.length;
    console.log(`Inserted ${insertedStudents.length} students for ${cls.name}.`);
  }

  console.log(`Seed complete. Total students inserted: ${totalInserted}`);
}

seed();
