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
  parentEmail: z.string().email("Email du responsable invalide").optional().or(z.literal('')),
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
  linked_staff_id: z.string().optional().nullable()
});
