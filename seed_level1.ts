import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
// Load environment variables from .env
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

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
  const { data: userProfile } = await supabase.from('profiles').select('*').eq('email', 'jackito46@gmail.com').single();
  if (!userProfile) {
    console.error('User not found');
    return;
  }
  const schoolId = userProfile.school_id;
  
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
      // Fallback: fetch all classes
      const { data: allClasses } = await supabase.from('classes').select('id, name').eq('school_id', schoolId).limit(5);
      if (allClasses && allClasses.length > 0) {
        console.log('Found these classes instead:', allClasses);
      }
      return;
  }
  console.log(`Found ${classes.length} Level I classes.`);
  console.log(classes.map(c => c.name));
  
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
              amount: 5000, // example registration fee in HTG
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
