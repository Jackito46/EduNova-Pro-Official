import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyAcademicSessions() {
  console.log('--- Vérification des Sessions Académiques ---');

  // 1. Lister toutes les sessions
  const { count, error: countError } = await supabase
    .from('academic_years')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Erreur lors du comptage des sessions:', countError);
    return;
  }

  console.log(`Nombre total de sessions (count): ${count}`);
  
  const { data: years, error: yearsError } = await supabase
    .from('academic_years')
    .select('*');

  if (yearsError) {
    console.error('Erreur lors de la récupération des sessions:', yearsError);
    return;
  }

  console.log(`Nombre total de sessions (data.length): ${years.length}`);
  
  if (years.length === 0) {
    console.log('Aucune session trouvée dans la base de données.');
    return;
  }

  // 2. Vérifier la cohérence is_active / status
  const inconsistent = years.filter(y => (y.is_active && y.status !== 'ACTIVE') || (!y.is_active && y.status === 'ACTIVE'));
  if (inconsistent.length > 0) {
    console.warn(`ATTENTION: ${inconsistent.length} sessions ont un statut incohérent avec is_active.`);
    console.table(inconsistent.map(y => ({ id: y.id, label: y.label, is_active: y.is_active, status: y.status })));
  } else {
    console.log('Cohérence is_active/status: OK');
  }

  // 3. Vérifier les écoles sans session active
  const schools = [...new Set(years.map(y => y.school_id))];
  const schoolsWithoutActive = schools.filter(schoolId => {
    const schoolYears = years.filter(y => y.school_id === schoolId);
    return !schoolYears.some(y => y.is_active);
  });

  if (schoolsWithoutActive.length > 0) {
    console.warn(`ATTENTION: ${schoolsWithoutActive.length} écoles n'ont pas de session active.`);
    console.log('Écoles concernées:', schoolsWithoutActive);
  } else {
    console.log('Toutes les écoles ont au moins une session active: OK');
  }

  // 4. Vérifier les écoles avec PLUSIEURS sessions actives
  const schoolsWithMultipleActive = schools.filter(schoolId => {
    const activeYears = years.filter(y => y.school_id === schoolId && y.is_active);
    return activeYears.length > 1;
  });

  if (schoolsWithMultipleActive.length > 0) {
    console.warn(`ATTENTION: ${schoolsWithMultipleActive.length} écoles ont PLUSIEURS sessions actives.`);
    console.log('Écoles concernées:', schoolsWithMultipleActive);
  } else {
    console.log('Aucune école n\'a de sessions actives multiples: OK');
  }

  // 5. Vérifier les liens orphelins (ex: enrollments sans session valide)
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('academic_year_id')
    .limit(1000);

  if (!enrollError && enrollments) {
    const yearIds = new Set(years.map(y => y.id));
    const orphanedEnrollments = enrollments.filter(e => !yearIds.has(e.academic_year_id));
    if (orphanedEnrollments.length > 0) {
      console.warn(`ATTENTION: ${orphanedEnrollments.length} inscriptions (échantillon) pointent vers des sessions inexistantes.`);
    } else {
      console.log('Inscriptions (échantillon): Liens sessions valides');
    }
  }
}

verifyAcademicSessions();
