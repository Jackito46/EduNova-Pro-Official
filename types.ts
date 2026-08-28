
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SCHOOL_ADMIN = 'SCHOOL_ADMIN',
  DIRECTOR = 'DIRECTOR',
  SECRETARY = 'SECRETARY',
  ACCOUNTANT = 'ACCOUNTANT',
  TEACHER = 'TEACHER',
  SUPERVISOR = 'SUPERVISOR',
  LIBRARIAN = 'LIBRARIAN',
  STUDENT = 'STUDENT',
  PARENT = 'PARENT'
}

export enum SchoolLevel {
  MATERNELLE = 'MATERNELLE',
  FONDAMENTALE = 'FONDAMENTALE',
  SECONDAIRE = 'SECONDAIRE',
  LICENCE = 'LICENCE',
  MASTER = 'MASTER',
  CERTIFICAT = 'CERTIFICAT',
  DIPLOME = 'DIPLOME'
}

export enum SchoolType {
  CLASSIC = 'CLASSIC',
  UNIVERSITY = 'UNIVERSITY',
  PROFESSIONAL = 'PROFESSIONAL'
}

export type DocumentStatus = 'VALIDE' | 'REJETE' | 'EN_ATTENTE';

export interface StudentDocumentItem {
  id: string;
  name: string;
  description?: string;
  status: DocumentStatus;
  notes?: string;
  updated_at?: string;
  updated_by?: string;
}

export type StudentDocumentsMap = Record<string, {
  name?: string;
  status: DocumentStatus;
  notes?: string;
  updated_at?: string;
  updated_by?: string;
}>;

export interface StudentAttendance {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  reason?: string;
  recorded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface StaffAttendance {
  id: string;
  school_id: string;
  staff_id: string;
  assignment_id?: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  status: 'Présent' | 'Absent' | 'Retard' | 'Remplacé';
  notes?: string;
  validated_by?: string;
  validated_at?: string;
  created_at: string;
  updated_at: string;
  staff?: StaffMember;
  assignment?: StaffAssignment;
}

export interface CatalogItem {
  id: string;
  label: string;
  unit_price: number;
  category: string;
  academic_year_id?: string;
  currency?: string;
  planned_exchange_rate?: number;
  stock_quantity?: number;
  low_stock_threshold?: number;
  discipline_name?: string | null;
  unit_measure?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  school_id: string | null;
  campus_id?: string | null;
  avatar_url?: string;
  is_super_admin?: boolean;
  is_active?: boolean;
  force_password_change?: boolean;
  current_session_id?: string | null;
}

export interface StaffMember {
  id: string;
  school_id: string;
  campus_id?: string | null;
  first_name: string;
  last_name: string;
  gender: string;
  dob: string;
  nif_cin: string;
  phone: string;
  email?: string;
  address: string;
  role: string;
  contract_type: 'Permanent' | 'Vacationnaire';
  pay_type: 'Fixe' | 'Horaire';
  amount: number;
  weekly_hours?: number;
  bank_name?: string;
  bank_account?: string;
  status: 'Actif' | 'Congé' | 'Inactif' | 'Licencié';
  created_at?: string;
  calculated_base_salary?: number;
  termination_details?: {
    reason: string;
    notice_amount: number;
    date: string;
    fired_by: string;
  };
}

export interface StaffRole {
  id: string;
  label: string;
  description?: string;
}

export interface SchoolClass {
  id: string;
  school_id: string;
  campus_id?: string | null;
  name: string;
  level: string; // Used to be SchoolLevel but it can fall out of bounds
  teacher_name?: string;
  room?: string;
  description?: string;
  students_count?: number;
  subjects_count?: number;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string;
  description?: string;
}

export interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  coefficient: number;
  subject?: Subject;
  class?: SchoolClass;
}

export interface StaffAssignment {
  id: string;
  staff_id: string;
  subject_id: string;
  class_id?: string;
  subject_name: string;
  class_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  hourly_rate?: number;
  staff?: StaffMember;
}

export interface ClassSchedule {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  staff_id: string | null;
  day_of_week: number; // 1=Lundi, 7=Dimanche
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  room?: string;
  created_at?: string;
  
  // Relations for UI
  class?: SchoolClass;
  subject?: Subject;
  staff?: StaffMember;
}

export interface PayrollPeriod {
  id: string;
  school_id: string;
  campus_id?: string | null;
  month: number;
  year: number;
  status: 'DRAFT' | 'VALIDATED' | 'CLOSED';
  created_at: string;
  updated_at: string;
}

export interface PayrollSlip {
  id: string;
  period_id: string;
  campus_id?: string | null;
  staff_id: string;
  base_salary: number;
  bonuses: number;
  deductions: number;
  net_salary: number;
  status: 'UNPAID' | 'PAID';
  payment_date?: string;
  payment_method?: string;
  paid_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  staff?: StaffMember;
  period?: PayrollPeriod;
  paid_by_user?: UserProfile;
}

export interface CommunicationLog {
  id: string;
  school_id: string;
  sender_id: string;
  type: 'email' | 'sms' | 'whatsapp';
  recipient_type: 'parents' | 'teachers' | 'students' | 'individual' | 'class';
  recipient_count: number;
  subject?: string;
  content: string;
  status: 'sent' | 'failed' | 'pending';
  created_at: string;
  sender?: { full_name: string } | UserProfile;
}

export interface CommunicationRecipient {
  id: string;
  log_id: string;
  recipient_id?: string;
  recipient_name: string;
  recipient_contact: string;
  status: 'sent' | 'failed';
  error_message?: string;
  created_at: string;
}

export interface CommunicationSettings {
  school_id: string;
  email_from_name?: string;
  email_from_address?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  sms_provider?: string;
  sms_api_key?: string;
  whatsapp_provider?: string;
  whatsapp_api_key?: string;
  whatsapp_phone_number_id?: string;
  updated_at: string;
}

export interface SalaryAdvance {
  id: string;
  school_id: string;
  staff_id: string;
  amount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'DEDUCTED';
  requested_at: string;
  approved_at?: string;
  paid_at?: string;
  approved_by?: string;
  payment_method?: string;
  notes?: string;
  deduction_period_id?: string;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  staff?: StaffMember;
  approved_by_user?: UserProfile;
  deduction_period?: PayrollPeriod;
}

export interface PaymentGateway {
  id: string;
  school_id: string;
  gateway_name: string;
  client_id: string;
  client_secret: string;
  business_key: string;
  mode: 'sandbox' | 'live';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffSalaryHistory {
  id: string;
  staff_id: string;
  old_amount: number;
  new_amount: number;
  change_reason: string;
  effective_date: string;
  created_at: string;
  created_by: string;
  creator?: UserProfile;
}

export interface School {
  id: string;
  name: string;
  director_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  license_number?: string;
  logo_url?: string;
  stamp_url?: string;
  domain?: string;
  status?: string;
  subscription_plan?: string;
  subscription_start_date?: string;
  subscription_end_date?: string;
  school_type?: SchoolType;
  global_settings?: any;
  created_at?: string;
  has_multi_campus?: boolean;
  
  // New institutional fields
  website?: string;
  nif?: string;
  foundation_year?: number;
  motto?: string;
}

export interface CourseEvaluation {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  teacher_id?: string;
  term: string;
  name: string;
  weight_percentage?: number;
  total_marks: number;
  date?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CourseEvaluationWithDetails extends CourseEvaluation {
  class?: { name: string };
  subject?: { name: string; code: string };
  teacher?: { first_name: string; last_name: string };
}

export interface StudentSubject {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  status: string;
  created_at?: string;
  student?: { first_name: string; last_name: string; code: string };
}

export interface SchoolCampus {
  id: string;
  school_id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  created_at?: string;
}

declare global {
  const __BUILD_TIMESTAMP__: string | undefined;
  const __RENDER_GIT_COMMIT__: string | undefined;
  const __NODE_ENV__: string | undefined;
}



export interface AcademicYear {
  id: string;
  school_id: string;
  label: string;
  start_date: string;
  end_date: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'FUTURE' | 'PREPARATION' | 'PASSED';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
