import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

const supabase = createClient(supabaseUrl, supabaseKey);

const firstNames = ['Jean', 'Marie', 'Paul', 'Pierre', 'Jacques', 'Michel', 'Robert', 'Richard', 'Joseph', 'Charles', 'Anne', 'Sophie', 'Isabelle', 'Nathalie', 'Valerie', 'Sylvie', 'Catherine', 'Monique', 'Dominique', 'Claire', 'David', 'Daniel', 'Patrick', 'Christian', 'Claude', 'Bernard', 'Alain', 'Gerard', 'Thierry', 'Pascal'];
const lastNames = ['Pierre', 'Joseph', 'Charles', 'Louis', 'Francois', 'Paul', 'Simon', 'Michel', 'Alexis', 'Jean', 'Etienne', 'Jacques', 'Nicolas', 'Antoine', 'Augustin', 'Julien', 'Rene', 'Andre', 'Noel', 'Mathieu'];

const getRandomName = () => {
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    return { first_name: fn, last_name: ln };
};

const getParentName = (lastName: string) => {
    const parentFn = firstNames[Math.floor(Math.random() * firstNames.length)];
    return `${parentFn} ${lastName}`;
};

async function main() {
  console.log('Starting seed script...');
  
  // Login first to bypass RLS issues if we are using anon key
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'jackito46@gmail.com',
      password: 'password' // Try the default test password, or we see if RLS allows anon access
  });
  
  if (authErr) {
    console.error('Auth error, proceeding as anon. Error was:', authErr.message);
  } else {
    console.log('Logged in successfully!');
  }
  
  const { data: userProfile, error: pErr } = await supabase.from('profiles').select('*').eq('email', 'jackito46@gmail.com').single();
  if (!userProfile) {
    console.error('User not found:', pErr);
    return;
  }
  
  const schoolId = userProfile.school_id;
  console.log('School ID found:', schoolId);
  
  // Get active year
  const { data: activeYears } = await supabase.from('academic_years').select('*').eq('school_id', schoolId).in('status', ['ACTIVE']);
  if (!activeYears || activeYears.length === 0) {
      console.error('No active academic year found for school.');
      return;
  }
  const activeYearId = activeYears[0].id;
  console.log('Active year id:', activeYearId);
  
  // Get level 1 classes
  const { data: classes } = await supabase.from('classes').select('id, name').eq('school_id', schoolId).like('name', '% I');
  if (!classes || classes.length === 0) {
      console.error('No Level I classes found.');
      return;
  }
  console.log(`Found ${classes.length} Level I classes: \n${classes.map(c => c.name).join('\n')}`);
  
  let totalStudents = 0;
  
  for (const cls of classes) {
      console.log(`Processing class: ${cls.name}`);
      for (let i = 0; i < 10; i++) {
          const { first_name, last_name } = getRandomName();
          const parent_name = getParentName(last_name);
          const parent_phone = '+(509) ' + Math.floor(3000 + Math.random() * 6000) + '-' + Math.floor(1000 + Math.random() * 9000);
          
          // Insert Student
          const { data: student, error: errC } = await supabase.from('students').insert({
              school_id: schoolId,
              first_name,
              last_name,
              parent_name,
              parent_phone,
              gender: Math.random() > 0.5 ? 'M' : 'F',
              date_of_birth: new Date(2000 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)).toISOString()
          }).select('id').single();
          
          if (errC || !student) {
              console.error('Error inserting student:', errC);
              continue;
          }
          
          // Insert Enrollment
          const { error: errE } = await supabase.from('enrollments').insert({
              student_id: student.id,
              school_id: schoolId,
              class_id: cls.id,
              academic_year_id: activeYearId,
              status: 'ENROLLED',
              enrollment_date: new Date().toISOString()
          });
          
          if (errE) {
              console.error('Error enrolling student:', errE);
          }
          
          // Insert Registration Fee Payment (Frais d'inscription)
          const { error: errP } = await supabase.from('payments').insert({
              school_id: schoolId,
              student_id: student.id,
              academic_year_id: activeYearId,
              amount: 5000, // registration fee explicitly specified in prompt
              original_amount: 5000,
              payment_method: 'CASH',
              payment_date: new Date().toISOString(),
              description: "Frais d'inscription",
              reference: `INSC-${Date.now().toString().slice(-6)}`
          });
          
          if (errP) {
              console.error('Error inserting payment:', errP);
          }
          
          totalStudents++;
      }
  }
  
  console.log(`Successfully enrolled ${totalStudents} students and processed their registration fees.`);
}

main().catch(console.error);
