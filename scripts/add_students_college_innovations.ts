import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://iymzthjkucvhyjnxpslg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE'
);

const SCHOOL_ID = 'a0ed9087-0554-40ae-ac26-86599a183b16';
const ACTIVE_YEAR_ID = '8f7324ac-88bf-4ab9-a37c-83452cac8ce5';
const CAMPUS_ID = 'cac2032e-758e-469f-b3f3-df6d213382bc';

const FIRST_NAMES_MALE = [
  'Jean-Baptiste', 'Kervens', 'Samuel', 'Carl-Henry', 'Schneider', 
  'Woodley', 'Widner', 'Stevenson', 'Dieuson', 'Wilghens', 
  'Stanley', 'Patrick', 'David', 'Mackenson', 'Gregory',
  'Djenny', 'Sebastien', 'Emmanuel', 'Alexandre', 'Rodney'
];

const FIRST_NAMES_FEMALE = [
  'Marie-Michelle', 'Stephanie', 'Widlène', 'Lovelie', 'Shedlyne',
  'Djenika', 'Naomie', 'Kethleen', 'Ruth-Vanessa', 'Mirlande',
  'Florence', 'Esther', 'Blandine', 'Christelle', 'Jessica',
  'Anatolie', 'Carline', 'Sherley', 'Daphnée', 'Samantha'
];

const LAST_NAMES = [
  'PIERRE', 'JEAN', 'JOSEPH', 'CHARLES', 'CELESTIN',
  'AUGUSTIN', 'FRANÇOIS', 'ALEXANDRE', 'HIPPOLYTE', 'PHILIPPE',
  'THEODORE', 'HYPPOLITE', 'LOUIS', 'PAUL', 'MICHEL',
  'DESROSIERS', 'CASSEUS', 'BAPTISTE', 'DORÉUS', 'SYLVESTRE'
];

const CITIES = ['Port-au-Prince', 'Pétion-Ville', 'Delmas', 'Carrefour', 'Tabarre', 'Kenscoff'];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomPhone(): string {
  const prefix = ['37', '38', '36', '31', '34', '47', '48'][Math.floor(Math.random() * 7)];
  const num = Math.floor(100000 + Math.random() * 900000);
  return `+509 ${prefix}${num}`;
}

const DOB_MAP: Record<string, number> = {
  'Petite Section': 2022,
  'Moyenne Section': 2021,
  'Grande Section': 2020,
  '1ère AF': 2019,
  '2ème AF': 2018,
  '3ème AF': 2017,
  '4ème AF': 2016,
  '5ème AF': 2015,
  '6ème AF': 2014,
  '7ème AF': 2013,
  '8ème AF': 2012,
  '9ème AF': 2011,
  'NS I': 2010,
  'NS II': 2009,
  'NS III': 2008,
  'NS IV': 2007
};

async function seedStudents() {
  console.log('--- DEBUT DE L\'AJOUT DES 10 ÉLÈVES PAR CLASSE (COLLÈGE DES INNOVATIONS) ---');

  // 1. Fetch classes for Collège des Innovations
  const { data: classes, error: classErr } = await supabase.rpc('exec_custom', {
    sql_query: `SELECT id, name, level FROM public.classes WHERE school_id = '${SCHOOL_ID}' ORDER BY sort_order;`.trim()
  });

  if (classErr || !Array.isArray(classes)) {
    console.error('Erreur chargement classes:', classErr);
    return;
  }

  console.log(`Nombre de classes trouvées : ${classes.length}`);

  // 2. Fetch fee plans to get inscription amounts
  const { data: feePlans } = await supabase.rpc('exec_custom', {
    sql_query: `SELECT class_id, inscription_fee, inscription_fee_usd FROM public.fee_plans WHERE school_id = '${SCHOOL_ID}' AND academic_year_id = '${ACTIVE_YEAR_ID}';`.trim()
  });

  const feeMap: Record<string, number> = {};
  if (Array.isArray(feePlans)) {
    feePlans.forEach((fp: any) => {
      feeMap[fp.class_id] = Number(fp.inscription_fee) || 2500;
    });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  let totalStudentsAdded = 0;
  let totalEnrollmentsAdded = 0;
  let totalPaymentsAdded = 0;

  for (const cls of classes) {
    const classId = cls.id;
    const className = cls.name;
    const birthYear = DOB_MAP[className] || 2015;
    const inscriptionFee = feeMap[classId] || 2500;

    console.log(`\nTraitement de la classe : ${className} (Frais d'inscription : ${inscriptionFee} HTG)...`);

    for (let i = 1; i <= 10; i++) {
      const isMale = i % 2 !== 0;
      const firstName = isMale ? getRandomElement(FIRST_NAMES_MALE) : getRandomElement(FIRST_NAMES_FEMALE);
      const lastName = getRandomElement(LAST_NAMES);
      const gender = isMale ? 'Masculin' : 'Féminin';
      
      const birthMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const birthDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      const dob = `${birthYear}-${birthMonth}-${birthDay}`;
      
      const pob = getRandomElement(CITIES);
      const address = `${getRandomElement(['Rue Louverture', 'Blvd 15 Octobre', 'Route de Kenscoff', 'Avenue Panaméricaine', 'Rue Faubert'])}, ${pob}`;
      
      const parentLastName = Math.random() > 0.4 ? lastName : getRandomElement(LAST_NAMES);
      const parentFirstName = isMale ? getRandomElement(FIRST_NAMES_MALE) : getRandomElement(FIRST_NAMES_FEMALE);
      const parentName = `${parentFirstName} ${parentLastName}`;
      const parentRelation = isMale ? (Math.random() > 0.2 ? 'Père' : 'Mère') : (Math.random() > 0.2 ? 'Mère' : 'Père');
      const parentPhone = getRandomPhone();

      const insertStudentSql = `INSERT INTO public.students (school_id, campus_id, class_id, first_name, last_name, gender, dob, pob, address, parent_name, parent_relation, parent_phone, status) VALUES ('${SCHOOL_ID}', '${CAMPUS_ID}', '${classId}', '${firstName.replace(/'/g, "''")}', '${lastName.replace(/'/g, "''")}', '${gender}', '${dob}', '${pob.replace(/'/g, "''")}', '${address.replace(/'/g, "''")}', '${parentName.replace(/'/g, "''")}', '${parentRelation}', '${parentPhone}', 'Actif') RETURNING id;`.trim();

      const studentIdRes = await supabase.rpc('exec_custom', { sql_query: insertStudentSql });

      if (!studentIdRes.data || !Array.isArray(studentIdRes.data) || studentIdRes.data.length === 0) {
        console.error(`  Erreur création élève ${firstName} ${lastName}:`, studentIdRes.error || studentIdRes.data);
        continue;
      }

      const studentId = studentIdRes.data[0].id;
      totalStudentsAdded++;

      // Create enrollment
      const insertEnrollmentSql = `INSERT INTO public.enrollments (school_id, student_id, academic_year_id, class_id, status) VALUES ('${SCHOOL_ID}', '${studentId}', '${ACTIVE_YEAR_ID}', '${classId}', 'ACTIVE') RETURNING id;`.trim();

      await supabase.rpc('exec_custom', { sql_query: insertEnrollmentSql });
      totalEnrollmentsAdded++;

      // Create inscription payment record
      const insertPaymentSql = `INSERT INTO public.payments (school_id, campus_id, student_id, academic_year_id, date, amount, amount_htg_equivalent, exchange_rate_applied, currency, nature, type, fee_type, method, payment_method, status) VALUES ('${SCHOOL_ID}', '${CAMPUS_ID}', '${studentId}', '${ACTIVE_YEAR_ID}', '${todayStr}', ${inscriptionFee}, ${inscriptionFee}, 1, 'HTG', 'RECOUVREMENT', 'Revenu', 'INSCRIPTION', 'Cash', 'Cash', 'VALIDE') RETURNING id;`.trim();

      await supabase.rpc('exec_custom', { sql_query: insertPaymentSql });
      totalPaymentsAdded++;
    }
    console.log(`  -> 10 élèves créés et inscrits avec succès dans ${className}.`);
  }

  console.log('\n==================================================');
  console.log(`SUCCÈS BASSIN ÉLÈVES ET INSCRIPTIONS :`);
  console.log(`- Total Établissement : Collège des Innovations`);
  console.log(`- Année Académique Active : 2025-2026`);
  console.log(`- Classes traitées : ${classes.length}`);
  console.log(`- Total Élèves créés : ${totalStudentsAdded}`);
  console.log(`- Total Inscriptions académiques actives : ${totalEnrollmentsAdded}`);
  console.log(`- Total Reçus de frais d'inscription encaissés : ${totalPaymentsAdded} (${totalPaymentsAdded * 2500} HTG)`);
  console.log('==================================================');
}

seedStudents();
