import { z } from 'zod';

export const studentSchema = z.object({
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  gender: z.enum(['Masculin', 'Féminin']),
  dob: z.string().min(1, "La date de naissance est obligatoire"),
  pob: z.string().optional(),
  nif: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal('')),
  parentName: z.string().min(2, "Le nom du responsable doit contenir au moins 2 caractères"),
  parentRelation: z.string().min(1, "Le lien de parenté est obligatoire"),
  parentPhone: z.string().min(4, "Le téléphone du responsable est obligatoire"),
  parentEmail: z.string().refine(
    (val) => {
      if (!val || val.trim() === '') return true;
      const trimmed = val.trim();
      if (!trimmed.includes('@')) {
        return /^[a-zA-Z0-9._-]{2,}$/.test(trimmed);
      }
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    },
    { message: "Email ou identifiant (pseudo) du responsable invalide" }
  ).optional().or(z.literal('')),
  parentJob: z.string().optional()
});

export const staffSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  gender: z.enum(['M', 'F', 'Masculin', 'Féminin']),
  dob: z.string().optional().or(z.literal('')),
  phone: z.string().min(4, "Le téléphone est obligatoire"),
  email: z.string().email("Email invalide").optional().or(z.literal('')),
  address: z.string().optional(),
  nif_cin: z.string().optional(),
  role: z.string().min(1, "Le poste est obligatoire"),
  contractType: z.string().min(1, "Le type de contrat est obligatoire"),
  payType: z.string().min(1, "Le type de paiement est obligatoire"),
  amount: z.string().min(1, "Le montant est obligatoire").or(z.number()),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  campus_id: z.string().optional()
});

export const expenseSchema = z.object({
  categoryId: z.string().optional(),
  amount: z.string().min(1, "Le montant est obligatoire").or(z.number().positive("Le montant doit être supérieur à 0")),
  currency: z.enum(['HTG', 'USD']),
  date: z.string().optional(),
  expense_date: z.string().optional(),
  beneficiary: z.string().optional(),
  label: z.string().min(2, "Le libellé (beneficiary) est obligatoire"),
  description: z.string().optional(),
  reference: z.string().optional(),
  category_id: z.string().min(1, "La catégorie est obligatoire"),
  campus_id: z.string().optional()
});

export const classSchema = z.object({
  name: z.string().min(2, "Le nom de la classe doit contenir au moins 2 caractères"),
  level: z.string().min(2, "Le niveau/cycle est obligatoire"),
  teacher: z.string().optional(),
  room: z.string().optional(),
  description: z.string().optional(),
  duration: z.string().optional().or(z.number()),
  examsCount: z.number().int().min(1, "Le nombre d'examens est invalide").optional(),
  periodFormat: z.string().optional(),
  campus_id: z.string().optional(),
  division: z.string().optional()
});

export const tuitionPaymentSchema = z.object({
  amount: z.number().positive("Le montant doit être supérieur à 0"),
  currency: z.enum(['HTG', 'USD']),
  paymentMethod: z.string().min(1, "La méthode de paiement est obligatoire"),
  date: z.string().min(1, "La date est obligatoire"),
  reference: z.string().optional(),
  notes: z.string().optional()
});

export const userSchema = z.object({
  email: z.string().min(3, "L'identifiant ou email doit contenir au moins 3 caractères"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères").regex(/[A-Z]/, "Le mot de passe doit contenir au moins une lettre majuscule.").regex(/[a-z]/, "Le mot de passe doit contenir au moins une lettre minuscule.").regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre.").regex(/[^A-Za-z0-9]/, "Le mot de passe doit contenir au moins un caractère spécial."),
  full_name: z.string().min(2, "Le nom complet doit contenir au moins 2 caractères"),
  role: z.string(),
  campus_id: z.string().optional().nullable(),
  linked_staff_id: z.string().optional().nullable(),
  is_autonomous: z.boolean().optional(),
  expires_at: z.string().optional().nullable(),
  access_duration_label: z.string().optional().nullable()
});

export interface DemoFormValues {
  schoolName: string;
  contactName: string;
  phone: string;
  email: string;
  preferredChannel: 'both' | 'whatsapp' | 'email';
  notes: string;
}

export type DemoFormField = keyof DemoFormValues;
export type DemoFormErrors = Partial<Record<DemoFormField, string>>;

const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

const LETTER_REGEX = /[A-Za-zÀ-ÖØ-öø-ÿ]/g;

export function validateDemoPhone(rawPhone: string): string | null {
  const trimmed = rawPhone.trim();
  if (!trimmed) {
    return 'Le numéro WhatsApp ou téléphone est obligatoire.';
  }
  if (trimmed.length > 50) {
    return 'Le numéro de téléphone est trop long (50 caractères max).';
  }
  if (!/^\+?[\d\s().-]+$/.test(trimmed) || trimmed.indexOf('+', 1) !== -1) {
    return 'Format invalide : utilisez uniquement des chiffres, espaces, tirets ou un indicatif (+509...).';
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8) {
    return 'Numéro incomplet : saisissez au moins 8 chiffres (ex: +509 3604-5639).';
  }
  if (digits.length > 15) {
    return 'Numéro trop long : maximum 15 chiffres selon le format international.';
  }
  if (/^(\d)\1+$/.test(digits)) {
    return 'Veuillez saisir un numéro de téléphone valide.';
  }
  if ((trimmed.startsWith('+509') || (digits.startsWith('509') && digits.length > 8)) && digits.length !== 11) {
    return 'Un numéro haïtien (+509) doit comporter exactement 8 chiffres après +509.';
  }
  return null;
}

export function validateDemoEmail(rawEmail: string, isRequired = false): string | null {
  const trimmed = rawEmail.trim();
  if (!trimmed) {
    return isRequired
      ? 'Votre adresse email est requise pour recevoir une réponse par email.'
      : null;
  }
  if (trimmed.length > 160) {
    return 'L’adresse email ne doit pas dépasser 160 caractères.';
  }
  if (trimmed.includes('..') || !STRICT_EMAIL_REGEX.test(trimmed)) {
    return 'Format d’adresse email invalide (ex: direction@ecole.edu.ht).';
  }
  return null;
}

export function validateDemoSchoolName(rawSchoolName: string): string | null {
  const trimmed = rawSchoolName.trim();
  if (!trimmed) {
    return 'Le nom de l’établissement est obligatoire.';
  }
  if (trimmed.length < 3) {
    return 'Le nom de l’établissement doit contenir au moins 3 caractères.';
  }
  if (trimmed.length > 160) {
    return 'Le nom de l’établissement ne doit pas dépasser 160 caractères.';
  }
  const letters = trimmed.match(LETTER_REGEX) || [];
  if (letters.length < 2) {
    return 'Veuillez saisir un nom d’établissement valide (lettres requises).';
  }
  return null;
}

export function validateDemoContactName(rawContactName: string): string | null {
  const trimmed = rawContactName.trim();
  if (!trimmed) {
    return 'Votre nom et votre fonction sont obligatoires.';
  }
  if (trimmed.length < 2) {
    return 'Votre nom doit contenir au moins 2 caractères.';
  }
  if (trimmed.length > 120) {
    return 'Votre nom ne doit pas dépasser 120 caractères.';
  }
  const letters = trimmed.match(LETTER_REGEX) || [];
  if (letters.length < 2) {
    return 'Veuillez saisir un nom valide (au moins 2 lettres).';
  }
  return null;
}

export function validateDemoNotes(rawNotes: string): string | null {
  const trimmed = rawNotes.trim();
  if (trimmed.length > 800) {
    return 'Votre message ne doit pas dépasser 800 caractères.';
  }
  return null;
}

export const demoRequestSchema = z
  .object({
    schoolName: z.string().superRefine((val, ctx) => {
      const err = validateDemoSchoolName(val);
      if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, message: err });
    }),
    contactName: z.string().superRefine((val, ctx) => {
      const err = validateDemoContactName(val);
      if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, message: err });
    }),
    phone: z.string().superRefine((val, ctx) => {
      const err = validateDemoPhone(val);
      if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, message: err });
    }),
    email: z.string(),
    preferredChannel: z.enum(['both', 'whatsapp', 'email']),
    notes: z.string().superRefine((val, ctx) => {
      const err = validateDemoNotes(val);
      if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, message: err });
    })
  })
  .superRefine((data, ctx) => {
    const emailErr = validateDemoEmail(data.email, data.preferredChannel === 'email');
    if (emailErr) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: emailErr });
    }
  });

export function validateDemoField(field: DemoFormField, values: DemoFormValues): string | null {
  switch (field) {
    case 'schoolName':
      return validateDemoSchoolName(values.schoolName);
    case 'contactName':
      return validateDemoContactName(values.contactName);
    case 'phone':
      return validateDemoPhone(values.phone);
    case 'email':
      return validateDemoEmail(values.email, values.preferredChannel === 'email');
    case 'notes':
      return validateDemoNotes(values.notes);
    default:
      return null;
  }
}

export function validateDemoForm(values: DemoFormValues): DemoFormErrors {
  const result = demoRequestSchema.safeParse(values);
  if (result.success) return {};
  const errors: DemoFormErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as DemoFormField | undefined;
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

