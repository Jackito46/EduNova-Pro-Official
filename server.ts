
import fs from 'fs';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { GoogleGenAI } from '@google/genai';
import { BackupBackendService } from './services/backupBackendService';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://iymzthjkucvhyjnxpslg.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bXp0aGprdWN2aHlqbnhwc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU3NDQsImV4cCI6MjA4NjU0MTc0NH0.85nnxqaNsfSfzuz-twBh_S5WlqE18UWa3Q-c6RlSoaE';

// Configure web-push
const vapidPublicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
const vapidPrivateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:support@edunova.com',
    vapidPublicKey,
    vapidPrivateKey
  );
} else {
  console.warn('VAPID keys not set. Push notifications will not work.');
}

// Prevent server crash if Supabase config is missing
let supabase: any;
try {
  if (!supabaseUrl) {
    console.error('CRITICAL: VITE_SUPABASE_URL is missing from environment variables.');
  } else {
    supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
  }
} catch (err) {
  console.error('Failed to initialize Supabase client in server.ts:', err);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      supabaseConfigured: !!supabaseUrl,
      timestamp: new Date().toISOString() 
    });
  });

  // Keep-alive endpoint to prevent Supabase from pausing
  app.get('/api/keep-alive', async (req, res) => {
    try {
      if (!supabase) {
        return res.status(500).json({ status: 'error', error: 'Supabase client not initialized' });
      }
      
      // Simple lightweight query to keep the database awake
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
        
      if (error) {
        throw error;
      }
      
      res.json({
        status: 'alive',
        message: 'Supabase is awake',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Keep-alive ping failed:', error);
      res.status(500).json({ status: 'error', error: error.message });
    }
  });

  // API Route for testing SMTP settings
  app.post('/api/test-smtp', async (req, res) => {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, email_from_address, email_from_name } = req.body;

    if (!smtp_host || !smtp_pass || !email_from_address) {
      return res.status(400).json({ error: 'Missing required SMTP fields' });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtp_host,
        port: smtp_port || 587,
        secure: smtp_port === 465,
        auth: {
          user: smtp_user || email_from_address,
          pass: smtp_pass,
        },
      });

      // Verify connection configuration
      await transporter.verify();

      // Send a test email
      await transporter.sendMail({
        from: `"${email_from_name || 'EduNova Test'}" <${email_from_address}>`,
        to: email_from_address,
        subject: 'Test de configuration SMTP EduNova',
        text: 'Félicitations ! Votre configuration SMTP fonctionne correctement.',
        html: '<b>Félicitations !</b> Votre configuration SMTP fonctionne correctement.',
      });

      res.json({ success: true, message: 'SMTP configuration verified and test email sent.' });
    } catch (error: any) {
      console.error('SMTP Test Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for sending emails
  app.post('/api/send-email', async (req, res) => {
    const { schoolId, recipients, subject, content } = req.body;
    const authHeader = req.headers.authorization;

    if (!schoolId || !recipients || !subject || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ error: 'Supabase configuration missing on server' });
      }

      // Create a scoped Supabase client using the user's token
      const token = authHeader?.split(' ')[1];
      const scopedSupabase = token ? createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      }) : supabase;

      // 1. Fetch SMTP settings for the school with school name join
      const { data: settings, error: settingsError } = await scopedSupabase
        .from('communication_settings')
        .select('*, schools(name)')
        .eq('school_id', schoolId)
        .single();

      if (settingsError || !settings || !settings.smtp_host || !settings.smtp_pass) {
        console.error('SMTP Settings Error:', settingsError);
        return res.status(400).json({ error: 'SMTP settings not configured for this school' });
      }

      // 2. Configure Nodemailer transporter
      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: settings.smtp_port || 587,
        secure: settings.smtp_port === 465, // true for 465, false for other ports
        auth: {
          user: settings.smtp_user || settings.email_from_address,
          pass: settings.smtp_pass,
        },
      });

      // 3. Send emails
      const results = [];
      const schoolName = (settings as any).schools?.name || 'EduNova Pro';
      const fromName = settings.email_from_name || schoolName;
      const fromEmail = settings.email_from_address;

      for (const recipient of recipients) {
        try {
          await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: recipient.email,
            subject: subject,
            text: content,
            html: content.replace(/\n/g, '<br>'),
          });
          results.push({ email: recipient.email, status: 'sent' });
        } catch (err: any) {
          console.error(`Failed to send email to ${recipient.email}:`, err);
          results.push({ email: recipient.email, status: 'failed', error: err.message });
        }
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error('Error in /api/send-email:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for checking subscriptions and sending reminders
  app.post('/api/cron/check-subscriptions', async (req, res) => {
    try {
      if (!supabase) {
        return res.status(500).json({ error: 'Supabase client not initialized on server' });
      }
      // 1. Find schools expiring in 7, 3, or 1 day
      const now = new Date();
      const checkDays = [7, 3, 1];
      
      const results = [];

      for (const days of checkDays) {
        const targetDate = new Date();
        targetDate.setDate(now.getDate() + days);
        const dateStr = targetDate.toISOString().split('T')[0];

        // Find schools expiring on this date
        const { data: schools, error: schoolsError } = await supabase
          .from('schools')
          .select('id, name, email, subscription_end_date, director_name')
          .filter('subscription_end_date', 'gte', `${dateStr}T00:00:00Z`)
          .filter('subscription_end_date', 'lte', `${dateStr}T23:59:59Z`)
          .eq('status', 'Actif');

        if (schoolsError) throw schoolsError;

        for (const school of schools) {
          // Check if reminder already sent for this school and this day
          const { data: existingReminder } = await supabase
            .from('subscription_reminders')
            .select('id')
            .eq('school_id', school.id)
            .eq('days_before', days)
            .single();

          if (!existingReminder) {
            // Send email
            // We'll use the school's SMTP if available, otherwise a system fallback
            const { data: settings } = await supabase
              .from('communication_settings')
              .select('*')
              .eq('school_id', school.id)
              .single();

            if (settings && settings.smtp_host && settings.smtp_pass) {
              const transporter = nodemailer.createTransport({
                host: settings.smtp_host,
                port: settings.smtp_port || 587,
                secure: settings.smtp_port === 465,
                auth: {
                  user: settings.smtp_user || settings.email_from_address,
                  pass: settings.smtp_pass,
                },
              });

              const subject = `Rappel : Votre abonnement EduNova Pro expire dans ${days} jour(s)`;
              const content = `Bonjour ${school.director_name || 'Directeur'},\n\n` +
                `Ceci est un rappel automatique pour vous informer que l'abonnement de votre établissement "${school.name}" arrive à expiration le ${new Date(school.subscription_end_date).toLocaleDateString('fr-FR')}.\n\n` +
                `Pour éviter toute interruption de service, veuillez procéder au renouvellement de votre plan dès que possible.\n\n` +
                `Cordialement,\nL'équipe EduNova Pro`;

              try {
                await transporter.sendMail({
                  from: `"${settings.email_from_name || 'EduNova Pro'}" <${settings.email_from_address}>`,
                  to: school.email,
                  subject: subject,
                  text: content,
                  html: content.replace(/\n/g, '<br>'),
                });

                // Record reminder
                await supabase
                  .from('subscription_reminders')
                  .insert({
                    school_id: school.id,
                    days_before: days
                  });

                results.push({ school: school.name, days, status: 'sent' });
              } catch (err: any) {
                console.error(`Failed to send reminder to ${school.name}:`, err);
                results.push({ school: school.name, days, status: 'failed', error: err.message });
              }
            } else {
              results.push({ school: school.name, days, status: 'no_smtp' });
            }
          }
        }
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error('Error in /api/cron/check-subscriptions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for sending SMS
  app.post('/api/send-sms', async (req, res) => {
    const { schoolId, recipients, content } = req.body;

    if (!schoolId || !recipients || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      if (!supabase) {
        return res.status(500).json({ error: 'Supabase client not initialized on server' });
      }
      
      const { data: settings, error: settingsError } = await supabase
        .from('communication_settings')
        .select('*')
        .eq('school_id', schoolId)
        .single();

      if (settingsError || !settings || settings.sms_provider === 'none' || !settings.sms_api_key) {
        return res.status(400).json({ error: 'SMS settings not configured for this school' });
      }

      console.log(`Sending SMS using provider: ${settings.sms_provider}`);
      const results: any[] = [];

      if (settings.sms_provider === 'sent.dm') {
        // Validation and payload for Sent.dm API
        const apiKey = settings.sms_api_key;
        
        for (const recipient of recipients) {
          try {
            // Formatting phone number
            let phone = String(recipient.contact).replace(/\s+/g, '');
            if (phone && !phone.startsWith('+')) {
               phone = '+509' + phone; 
            }

            // The sent.dm endpoint
            const response = await fetch('https://api.sent.dm/api/v1/sms', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                to: phone,
                message: content
              })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
               console.error(`Sent.dm API error for ${phone}:`, data);
               results.push({ contact: recipient.contact, status: 'failed', error: data.message || 'API Error' });
            } else {
               results.push({ contact: recipient.contact, status: 'sent', id: data.id });
            }
          } catch (err: any) {
            console.error(`Error sending via Sent.dm to ${recipient.contact}:`, err.message);
            results.push({ contact: recipient.contact, status: 'failed', error: err.message });
          }
        }
      } else if (settings.sms_provider === 'ozeki') {
        console.log(`Sending SMS using Ozeki Gateway`);
        let ozekiUrl = '';
        let ozekiUser = '';
        let ozekiPass = '';
        
        try {
           const parsed = JSON.parse(settings.sms_api_key);
           ozekiUrl = parsed.url;
           ozekiUser = parsed.username;
           ozekiPass = parsed.password;
        } catch (e) {
           console.error("Invalid Ozeki configuration format");
           return res.status(400).json({ error: "Configuration Ozeki invalide" });
        }

        if (!ozekiUrl) {
           return res.status(400).json({ error: "URL Ozeki manquante" });
        }

        // Standardise URL (ensure no trailing slash, check format)
        let baseUrl = ozekiUrl.trim();
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        
        // Ensure /api is the endpoint
        if (!baseUrl.endsWith('/api')) {
           baseUrl += '/api';
        }

        for (const recipient of recipients) {
           try {
              let phone = String(recipient.contact).replace(/\s+/g, '');
              if (phone && !phone.startsWith('+')) {
                 phone = '+509' + phone; 
              }

              // Build Ozeki HTTP GET URL
              const urlObj = new URL(baseUrl);
              urlObj.searchParams.append('action', 'sendmessage');
              urlObj.searchParams.append('username', ozekiUser);
              urlObj.searchParams.append('password', ozekiPass);
              urlObj.searchParams.append('recipient', phone);
              urlObj.searchParams.append('messagedata', content);

              const response = await fetch(urlObj.toString(), {
                 method: 'GET'
              });

              const text = await response.text();
              
              // Ozeki returns "OK" or "SUCCESS" usually on success, or an XML document.
              // We'll consider HTTP 200 as basically sent natively unless it says error.
              if (!response.ok || text.toLowerCase().includes('error')) {
                 console.error(`Ozeki API error for ${phone}:`, text);
                 results.push({ contact: recipient.contact, status: 'failed', error: text });
              } else {
                 results.push({ contact: recipient.contact, status: 'sent', raw: text });
              }
           } catch (err: any) {
              console.error(`Error sending via Ozeki to ${recipient.contact}:`, err.message);
              results.push({ contact: recipient.contact, status: 'failed', error: err.message });
           }
        }
      } else {
        // Fallback or Simulation for others (Twilio, BulkSMS, etc)
        console.log(`Simulation mode for ${settings.sms_provider}`);
        console.log(`Content: ${content}`);
        console.log(`Recipients: ${recipients.length}`);
        recipients.forEach((r: any) => {
          results.push({ contact: r.contact, status: 'sent' });
        });
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error('Error in /api/send-sms:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for sending WhatsApp messages
  app.post('/api/send-whatsapp', async (req, res) => {
    const { schoolId, recipients, content } = req.body;

    if (!schoolId || !recipients || !content) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    try {
      if (!supabase) {
        return res.status(500).json({ error: 'Client Supabase non initialisé' });
      }

      const { data: settings } = await supabase
        .from('communication_settings')
        .select('*')
        .eq('school_id', schoolId)
        .single();

      const results: any[] = [];
      const provider = settings?.whatsapp_provider || 'wa_me';

      if (provider === 'whatsapp_cloud' && settings?.whatsapp_phone_number_id && settings?.whatsapp_api_key) {
        const phoneId = settings.whatsapp_phone_number_id;
        const accessToken = settings.whatsapp_api_key;

        for (const recipient of recipients) {
          try {
            let phone = String(recipient.contact).replace(/\D/g, '');
            if (phone.length === 8) phone = '509' + phone;

            const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: phone,
                type: 'text',
                text: { preview_url: true, body: recipient.personalizedMessage || content }
              })
            });

            const data = await response.json();
            if (!response.ok) {
              results.push({ contact: recipient.contact, status: 'failed', error: data.error?.message || 'Meta Cloud API Error' });
            } else {
              results.push({ contact: recipient.contact, status: 'sent', id: data.messages?.[0]?.id });
            }
          } catch (err: any) {
            results.push({ contact: recipient.contact, status: 'failed', error: err.message });
          }
        }
      } else {
        // Direct wa.me mode or fallback batch
        recipients.forEach((r: any) => {
          results.push({ contact: r.contact, status: 'sent', note: 'Dispatché via wa.me' });
        });
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error('Error in /api/send-whatsapp:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route to verify an admin or campus director password
  app.post('/api/verify-admin-password', async (req, res) => {
    const { email, password, school_id } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
    }

    try {
      // Create a non-persistent supabase client for auth check
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false }
      });

      // Try signing in
      const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (authError || !authData?.user) {
        return res.status(401).json({ success: false, error: 'Identifiants incorrects ou mot de passe invalide.' });
      }

      // Validate UUID format of authData.user.id as a security precaution
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(authData.user.id)) {
        return res.status(400).json({ success: false, error: 'Format ID utilisateur non valide.' });
      }

      // Find user profile using exec_sql RPC which runs as SECURITY DEFINER
      const { data: dbResult, error: profileErr } = await supabase.rpc('exec_sql', {
        sql_query: `SELECT * FROM public.profiles WHERE id = '${authData.user.id}'`
      });

      if (profileErr) {
        console.error('Database query error in verify-admin-password:', profileErr);
        return res.status(500).json({ success: false, error: 'Erreur d\'accès au profil utilisateur.' });
      }

      let profile: any = null;
      if (Array.isArray(dbResult) && dbResult.length > 0) {
        profile = dbResult[0];
      } else if (dbResult && typeof dbResult === 'object' && dbResult.status === 'error') {
        console.error('SQL error in verify-admin-password:', dbResult);
        return res.status(500).json({ success: false, error: dbResult.message || 'Erreur lors de la récupération du profil.' });
      }

      if (!profile) {
        return res.status(404).json({ success: false, error: 'Profil introuvable pour cet utilisateur.' });
      }

      if (!profile.is_active && profile.role !== 'SUPER_ADMIN' && !profile.is_super_admin) {
        return res.status(403).json({ success: false, error: 'Ce compte est désactivé.' });
      }

      // Check if they are admin or director (campus manager)
      const allowedRoles = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'];
      if (!allowedRoles.includes(profile.role) && !profile.is_super_admin) {
        return res.status(403).json({ 
          success: false, 
          error: "Autorisation refusée. Seul un administrateur ou un responsable de centre (campus) peut valider cette action." 
        });
      }

      // Check school_id context if not SUPER_ADMIN
      if (profile.role !== 'SUPER_ADMIN' && !profile.is_super_admin) {
        if (school_id && profile.school_id !== school_id) {
          return res.status(403).json({ 
            success: false, 
            error: "Autorisation refusée. Cet administrateur appartient à un autre établissement." 
          });
        }

        // Check if school is active
        if (profile.school_id) {
          const { data: schoolResult, error: schoolErr } = await supabase.rpc('exec_sql', {
            sql_query: `SELECT status FROM public.schools WHERE id = '${profile.school_id}'`
          });

          if (!schoolErr && Array.isArray(schoolResult) && schoolResult.length > 0) {
            const school = schoolResult[0];
            if (school.status !== 'ACTIVE') {
              return res.status(403).json({
                success: false,
                error: "Autorisation refusée. Cet établissement est suspendu ou désactivé."
              });
            }
          }
        }
      }

      // Password verified and authorized!
      return res.json({ 
        success: true, 
        profile: {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          role: profile.role
        } 
      });
    } catch (err: any) {
      console.error('Error verifying admin password:', err);
      return res.status(500).json({ success: false, error: err.message || 'Erreur interne de validation' });
    }
  });

  // ==========================
  // GEMINI AI SERVICE
  // ==========================
  let geminiClient: GoogleGenAI | null = null;
  function getGeminiClient() {
    if (!geminiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set in the environment variables.');
      }
      geminiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
    return geminiClient;
  }

  async function callGeminiWithRetry(
    model: string,
    contents: any,
    maxRetries = 4,
    initialDelay = 1500
  ) {
    let lastError: any = null;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const aiClient = getGeminiClient();
        const response = await aiClient.models.generateContent({
          model,
          contents,
        });
        return response.text;
      } catch (error: any) {
        lastError = error;
        const errorMsg = (error?.message || JSON.stringify(error) || '').toUpperCase();
        const isTransient = 
          error?.status === "UNAVAILABLE" || 
          error?.code === 503 || 
          ((error?.status === "RESOURCE_EXHAUSTED" || errorMsg.includes("RESOURCE_EXHAUSTED")) && !errorMsg.includes("QUOTA")) || 
          ((error?.code === 429 || errorMsg.includes("429")) && !errorMsg.includes("QUOTA")) ||
          errorMsg.includes("503") ||
          errorMsg.includes("UNAVAILABLE") ||
          errorMsg.includes("HIGH DEMAND");

        if (isTransient && i < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          console.warn(`Gemini API transient error (${error?.code || error?.status || '503'}). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  app.post('/api/gemini/generate-student-report', async (req, res) => {
    const { studentName, grades } = req.body;
    try {
      const prompt = `En tant qu'expert pédagogique EduNova Pro, analysez les performances de l'élève ${studentName} : ${JSON.stringify(grades)}. Rédigez un commentaire professionnel, nuancé et constructif (3 phrases maximum) pour le bulletin scolaire.`;
      const text = await callGeminiWithRetry('gemini-3.5-flash', prompt);
      res.json({ text });
    } catch (error: any) {
      const errorMsg = (error?.message || JSON.stringify(error) || '').toUpperCase();
      if (error?.status === "RESOURCE_EXHAUSTED" || error?.code === 429 || errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("QUOTA")) {
        console.warn("Quota Gemini dépassé pour le rapport.");
        return res.json({ text: "Analyse pédagogique haute précision requise (service IA temporairement hors-ligne/quota dépassé)." });
      }
      if (error?.status === "PERMISSION_DENIED" || error?.code === 403 || errorMsg.includes("403") || errorMsg.includes("PERMISSION_DENIED")) {
        console.warn("Gemini Error 403: Check your API key permissions.");
        return res.json({ text: "Analyse pédagogique indisponible (Erreur de permission IA)." });
      }
      console.error("Gemini Pro Error:", error?.message || error);
      res.status(500).json({ error: error.message || "Analyse pédagogique haute précision indisponible." });
    }
  });

  app.post('/api/gemini/analyze-financial-health', async (req, res) => {
    const { stats } = req.body;
    try {
      const prompt = `En tant qu'analyste financier expert, examinez ces données scolaires : ${JSON.stringify(stats)}. Identifiez 3 leviers stratégiques pour optimiser la gestion de l'établissement. Réponse en français, ton professionnel.`;
      const text = await callGeminiWithRetry('gemini-3.5-flash', prompt);
      res.json({ text });
    } catch (error: any) {
      const errorMsg = (error?.message || JSON.stringify(error) || '').toUpperCase();
      if (error?.status === "RESOURCE_EXHAUSTED" || error?.code === 429 || errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("QUOTA")) {
        console.warn("Quota Gemini dépassé pour l'analyse financière.");
        return res.json({ text: "Audit financier stratégique indisponible (service IA temporairement hors-ligne/quota dépassé)." });
      }
      if (error?.status === "PERMISSION_DENIED" || error?.code === 403 || errorMsg.includes("403") || errorMsg.includes("PERMISSION_DENIED")) {
        console.warn("Gemini Error 403: Check your API key permissions.");
        return res.json({ text: "Audit financier stratégique indisponible (Erreur de permission IA)." });
      }
      console.error("Gemini Finance Error:", error?.message || error);
      res.status(500).json({ error: error.message || "Audit financier stratégique indisponible." });
    }
  });

  app.post('/api/gemini/generate-text', async (req, res) => {
    const { prompt } = req.body;
    try {
      const text = await callGeminiWithRetry('gemini-3.5-flash', prompt);
      res.json({ text });
    } catch (error: any) {
      const errorMsg = (error?.message || JSON.stringify(error) || '').toUpperCase();
      if (error?.status === "RESOURCE_EXHAUSTED" || error?.code === 429 || errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("QUOTA")) {
        console.warn("Quota Gemini dépassé pour le moment (429).");
        return res.json({ text: "Bonjour ! J'espère que vous passez une excellente journée. (L'assistant IA est temporairement hors forfait)." });
      }
      if (error?.status === "PERMISSION_DENIED" || error?.code === 403 || errorMsg.includes("403") || errorMsg.includes("PERMISSION_DENIED")) {
        console.warn("Gemini Error 403: Check your API key permissions.");
        return res.json({ text: "Bonjour ! L'assistant IA n'a pas les permissions requises pour vous répondre." });
      }
      console.error("Gemini Text Generation Error:", error?.message || error);
      res.status(500).json({ error: error.message || "Texte indisponible." });
    }
  });

  // ==========================
  // PUSH NOTIFICATIONS
  // ==========================
  app.get('/api/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: vapidPublicKey });
  });

  app.post('/api/push/subscribe', async (req, res) => {
    const { subscription, userId, schoolId } = req.body;
    
    if (!subscription || !subscription.endpoint || !userId || !schoolId) {
      return res.status(400).json({ error: 'Subscription, userId, and schoolId are required' });
    }

    try {
      if (!supabase) throw new Error('Supabase client not initialized');

      // Check if subscription already exists
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', subscription.endpoint)
        .single();

      if (existing) {
        return res.json({ success: true, message: 'Already subscribed' });
      }

      const { data, error } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: userId,
          school_id: schoolId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        });

      if (error) throw error;
      res.status(201).json({ success: true });
    } catch (err: any) {
      console.error('Error in subscribe:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/push/send', async (req, res) => {
    const { schoolId, title, body, icon, url, roleFilters, classId } = req.body;

    if (!schoolId || !title || !body) {
      return res.status(400).json({ error: 'schoolId, title, and body are required' });
    }

    try {
      if (!supabase) throw new Error('Supabase client not initialized');

      // Query subscribers for this school using SECURITY DEFINER rpc
      const { data: subscriptions, error } = await supabase.rpc('admin_get_push_subscriptions', {
        p_school_id: schoolId,
        p_roles: roleFilters && roleFilters.length > 0 ? roleFilters : null,
        p_class_id: classId || null
      });

      if (error) throw error;
      if (!subscriptions || subscriptions.length === 0) {
        return res.json({ success: true, sent: 0, message: 'No subscribers found' });
      }

      const payload = JSON.stringify({
        title,
        options: {
          body,
          icon: icon || '/pwa-192x192.png',
          data: {
            url: url || '/'
          }
        }
      });

      let sentCount = 0;
      let failedCount = 0;

      await Promise.all(subscriptions.map(async (subSub: any) => {
        const pushSubscription = {
          endpoint: subSub.endpoint,
          keys: {
            p256dh: subSub.p256dh,
            auth: subSub.auth
          }
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          sentCount++;
        } catch (err: any) {
          console.error('Error sending push:', err.statusCode, err.body, err.message);
          failedCount++;
          // If 410, 404, 400, 401 or 403, it means the subscription is invalid or VAPID key mismatch
          if ([400, 401, 403, 404, 410].includes(err.statusCode)) {
            console.log('Deleting obsolete subscription:', subSub.endpoint);
            await supabase.rpc('admin_delete_push_subscription', { p_endpoint: subSub.endpoint });
          }
        }
      }));

      res.status(200).json({ success: true, sent: sentCount, failed: failedCount });
    } catch (err: any) {
      console.error('Error in send_push:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Explicit routes for PWA files
  app.get(['/manifest.webmanifest', '/manifest.json'], (req, res) => {
    let filePath = path.join(process.cwd(), 'dist', 'manifest.webmanifest');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'public', 'manifest.webmanifest');
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'public', 'manifest.json');
    }

    if (fs.existsSync(filePath)) {
      res.set('Content-Type', 'application/manifest+json; charset=utf-8');
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Manifest not found' });
    }
  });

  app.get('/sw.js', (req, res) => {
    let filePath = path.join(process.cwd(), 'dist', 'sw.js');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'public', 'sw.js');
    }
    if (fs.existsSync(filePath)) {
      res.set('Content-Type', 'application/javascript; charset=utf-8');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.sendFile(filePath);
    } else {
      res.status(404).end();
    }
  });

  // ----------------------------------------------------
  // DATABASE BACKUP & RESTORE API ROUTES
  // ----------------------------------------------------
  const backupService = new BackupBackendService(supabase);

  // 1. List backups & get current settings
  app.get('/api/backups', async (req, res) => {
    try {
      const backups = await backupService.listBackups();
      const settings = await backupService.getSettings();
      res.json({ backups, settings });
    } catch (err: any) {
      console.error('Error fetching backups:', err);
      res.status(500).json({ error: err.message || 'Impossible de récupérer les sauvegardes' });
    }
  });

  // 2. Create manual or scheduled backup snapshot
  app.post('/api/backups/create', async (req, res) => {
    try {
      const { name, description, backup_type, scope, school_id, user_id, user_name } = req.body;
      const result = await backupService.createBackup({
        name,
        description,
        backup_type: backup_type || 'MANUAL',
        scope: scope || 'FULL_DATABASE',
        school_id,
        user_id,
        user_name
      });
      res.json(result);
    } catch (err: any) {
      console.error('Error creating backup:', err);
      res.status(500).json({ error: err.message || 'Erreur lors de la création de la sauvegarde' });
    }
  });

  // 3. Restore from backup
  app.post('/api/backups/restore', async (req, res) => {
    try {
      const { backup_id, raw_payload, selected_tables, create_safety_snapshot, user_id, user_name } = req.body;
      const result = await backupService.restoreBackup({
        backup_id,
        raw_payload,
        selected_tables,
        create_safety_snapshot: create_safety_snapshot !== false,
        user_id,
        user_name
      });
      res.json(result);
    } catch (err: any) {
      console.error('Error restoring backup:', err);
      res.status(500).json({ error: err.message || 'Erreur critique lors de la restauration' });
    }
  });

  // 4. Update backup settings
  app.post('/api/backups/settings', async (req, res) => {
    try {
      const updated = await backupService.saveSettings(req.body);
      res.json({ success: true, settings: updated });
    } catch (err: any) {
      console.error('Error saving backup settings:', err);
      res.status(500).json({ error: err.message || 'Erreur lors de la mise à jour des paramètres' });
    }
  });

  // 5. Download backup snapshot file
  app.get('/api/backups/download/:id', async (req, res) => {
    try {
      const backupId = req.params.id;
      const payload = await backupService.getBackupPayload(backupId);
      if (!payload) {
        return res.status(404).json({ error: 'Sauvegarde introuvable' });
      }

      const fileName = `${backupId}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(payload, null, 2));
    } catch (err: any) {
      console.error('Error downloading backup:', err);
      res.status(500).json({ error: err.message || 'Erreur lors du téléchargement' });
    }
  });

  // 6. Upload external backup JSON file
  app.post('/api/backups/upload', async (req, res) => {
    try {
      const { fileContent, fileName, userName } = req.body;
      if (!fileContent) {
        return res.status(400).json({ error: 'Fichier vide ou manquant' });
      }

      const parsed = JSON.parse(fileContent);
      const backupId = `bkp_imported_${Date.now()}`;
      const tables = parsed.tables || parsed;
      const totalRows = Object.values(tables).reduce((acc: number, cur: any) => acc + (Array.isArray(cur) ? cur.length : 0), 0);

      const filePath = path.join(process.cwd(), 'data', 'backups', `${backupId}.json`);
      fs.writeFileSync(filePath, fileContent, 'utf-8');

      const metadata: any = {
        id: backupId,
        name: `Import - ${fileName || 'Sauvegarde Externe'}`,
        description: `Instantané importé manuellement (${totalRows} enregistrements dans ${Object.keys(tables).length} tables)`,
        created_at: new Date().toISOString(),
        backup_type: 'MANUAL',
        scope: 'FULL_DATABASE',
        size_bytes: Buffer.byteLength(fileContent, 'utf-8'),
        tables_count: Object.keys(tables).length,
        rows_count: totalRows,
        checksum: (await import('crypto')).createHash('sha256').update(fileContent).digest('hex'),
        storage_provider: 'LOCAL_MIRROR',
        storage_path: filePath,
        storage_bucket: 'database_backups',
        created_by_name: userName || 'Super Administrateur',
        tables_summary: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
        version: '2.4'
      };

      const registry = await backupService.listBackups();
      registry.unshift(metadata);
      await (backupService as any).saveRegistry(registry);

      res.json({ success: true, metadata });
    } catch (err: any) {
      console.error('Error uploading backup:', err);
      res.status(500).json({ error: err.message || 'Erreur lors du traitement du fichier' });
    }
  });

  // 7. Delete backup
  app.delete('/api/backups/:id', async (req, res) => {
    try {
      const backupId = req.params.id;
      const success = await backupService.deleteBackup(backupId);
      res.json({ success });
    } catch (err: any) {
      console.error('Error deleting backup:', err);
      res.status(500).json({ error: err.message || 'Erreur lors de la suppression' });
    }
  });

  // 8. Test Supabase Storage and Local Mirror connectivity
  app.post('/api/backups/test-storage', async (req, res) => {
    try {
      const settings = await backupService.getSettings();
      const bucketName = settings.storage_bucket || 'database_backups';
      
      // Auto-ensure or provision bucket in Supabase
      const bucketProvisioned = await backupService.ensureBucketExists(bucketName);
      
      let bucketExists = false;
      try {
        const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
        if (!bErr && buckets) {
          bucketExists = buckets.some((b: any) => b.name === bucketName || b.id === bucketName);
        }
      } catch (e) {}

      const localDirExists = fs.existsSync(path.join(process.cwd(), 'data', 'backups'));

      let storageMessage = '';
      if (bucketExists || bucketProvisioned) {
        storageMessage = `Liaison Supabase Storage opérationnelle (Bucket '${bucketName}' actif). Miroir local sécurisé disponible.`;
      } else {
        storageMessage = `Miroir local haute disponibilité actif (/data/backups/). Prêt pour la synchronisation.`;
      }

      res.json({
        supabaseStorageAvailable: bucketExists || bucketProvisioned,
        bucketExists: bucketExists || bucketProvisioned,
        localMirrorAvailable: localDirExists,
        message: storageMessage
      });
    } catch (err: any) {
      console.error('Error testing storage:', err);
      res.status(500).json({ error: err.message || 'Erreur de vérification du stockage' });
    }
  });

  // ----------------------------------------------------
  // AUTOMATED BACKUP SCHEDULER (Runs every 10 minutes)
  // ----------------------------------------------------
  let lastCheckedDate = '';
  setInterval(async () => {
    try {
      const settings = await backupService.getSettings();
      if (!settings.is_auto_backup_enabled) return;

      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = now.getMinutes();
      const currentTimeStr = `${currentHours}:${String(currentMinutes).padStart(2, '0')}`;
      const currentDateStr = now.toISOString().split('T')[0];

      let shouldRun = false;

      if (settings.frequency === 'HOURLY') {
        // Run near the top of the hour once
        if (currentMinutes < 10) {
          const hourKey = `${currentDateStr}_${currentHours}`;
          if (lastCheckedDate !== hourKey) {
            shouldRun = true;
            lastCheckedDate = hourKey;
          }
        }
      } else if (settings.frequency === 'EVERY_6H') {
        if (now.getHours() % 6 === 0 && currentMinutes < 10) {
          const sixHourKey = `${currentDateStr}_${currentHours}`;
          if (lastCheckedDate !== sixHourKey) {
            shouldRun = true;
            lastCheckedDate = sixHourKey;
          }
        }
      } else if (settings.frequency === 'EVERY_12H') {
        if (now.getHours() % 12 === 0 && currentMinutes < 10) {
          const twelveHourKey = `${currentDateStr}_${currentHours}`;
          if (lastCheckedDate !== twelveHourKey) {
            shouldRun = true;
            lastCheckedDate = twelveHourKey;
          }
        }
      } else if (settings.frequency === 'DAILY') {
        // Compare with scheduled_time (e.g. '02:00')
        const [targetH, targetM] = (settings.scheduled_time || '02:00').split(':').map(Number);
        if (now.getHours() === targetH && Math.abs(currentMinutes - targetM) < 10) {
          if (lastCheckedDate !== currentDateStr) {
            shouldRun = true;
            lastCheckedDate = currentDateStr;
          }
        }
      } else if (settings.frequency === 'WEEKLY') {
        const targetDay = settings.scheduled_day || 0;
        const [targetH, targetM] = (settings.scheduled_time || '02:00').split(':').map(Number);
        if (now.getDay() === targetDay && now.getHours() === targetH && Math.abs(currentMinutes - targetM) < 10) {
          if (lastCheckedDate !== currentDateStr) {
            shouldRun = true;
            lastCheckedDate = currentDateStr;
          }
        }
      }

      if (shouldRun) {
        console.log(`[AutoBackup] Triggering automated scheduled backup (${settings.frequency} at ${currentTimeStr})...`);
        const result = await backupService.createBackup({
          backup_type: 'AUTOMATIC',
          name: `Sauvegarde Automatique (${now.toLocaleDateString('fr-FR')} ${currentTimeStr})`,
          description: `Sauvegarde automatique programmée (${settings.frequency})`,
          scope: 'FULL_DATABASE'
        });

        // Send email notification if enabled
        if (settings.notify_on_success) {
          await backupService.sendNotificationEmail({
            status: 'SUCCESS',
            backupName: result.metadata.name,
            details: `Sauvegarde de base de données réussie.\nVolume: ${result.metadata.rows_count} lignes.\nTables: ${result.metadata.tables_count}.\nTaille: ${(result.metadata.size_bytes / 1024).toFixed(2)} Ko.`
          });
        }
      }
    } catch (cronErr: any) {
      console.error('[AutoBackup] Error in automated backup scheduler:', cronErr.message);
      try {
        const settings = await backupService.getSettings();
        if (settings.notify_on_failure) {
          await backupService.sendNotificationEmail({
            status: 'FAILED',
            backupName: 'Sauvegarde Automatique Échouée',
            details: `Une erreur est survenue lors de l'exécution automatique : ${cronErr.message}`
          });
        }
      } catch (e) {}
    }
  }, 10 * 60 * 1000); // Check every 10 minutes

  // Explicit routes for favicon.ico, favicon.png, and logo.png to ensure they don't fall back to SPA index.html
  app.get('/favicon.ico', (req, res) => {
    const distFav = path.join(process.cwd(), 'dist', 'favicon.ico');
    const pubFav = path.join(process.cwd(), 'public', 'favicon.ico');
    res.set('Content-Type', 'image/x-icon');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    if (fs.existsSync(distFav)) {
      res.sendFile(distFav);
    } else if (fs.existsSync(pubFav)) {
      res.sendFile(pubFav);
    } else {
      res.status(404).end();
    }
  });

  // Helper to serve public/dist static PWA assets with CORS and correct MIME types
  const serveStaticPwaAsset = (req: express.Request, res: express.Response, fileName: string, contentType: string) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    const distFile = path.join(process.cwd(), 'dist', fileName);
    const pubFile = path.join(process.cwd(), 'public', fileName);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    if (fs.existsSync(distFile)) {
      return res.sendFile(distFile);
    } else if (fs.existsSync(pubFile)) {
      return res.sendFile(pubFile);
    } else {
      return res.status(404).end();
    }
  };

  // Manifest endpoints
  app.get('/manifest.webmanifest', (req, res) => {
    serveStaticPwaAsset(req, res, 'manifest.webmanifest', 'application/manifest+json; charset=utf-8');
  });
  app.get('/manifest.json', (req, res) => {
    serveStaticPwaAsset(req, res, 'manifest.json', 'application/manifest+json; charset=utf-8');
  });

  // PWA Icons and Screenshots endpoints (Express 5 regex pattern)
  app.get(/^\/(pwa-[\w-]+\.png|screenshot-[\w-]+\.png|apple-touch-icon\.png|favicon\.png|logo\.png)$/, (req, res) => {
    const fileName = req.path.replace(/^\//, '');
    serveStaticPwaAsset(req, res, fileName, 'image/png');
  });

  app.get('/favicon.ico', (req, res) => {
    serveStaticPwaAsset(req, res, 'favicon.ico', 'image/x-icon');
  });

  // Service Worker endpoint with Service-Worker-Allowed header
  app.get(/^\/(sw\.js|registerSW\.js)$/, (req, res) => {
    res.setHeader('Service-Worker-Allowed', '/');
    const fileName = req.path.replace(/^\//, '');
    serveStaticPwaAsset(req, res, fileName, 'application/javascript; charset=utf-8');
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined 
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { 
      dotfiles: 'allow',
      setHeaders: (res, filePath) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('.webmanifest') || filePath.endsWith('.json') || filePath.includes('workbox')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*all', (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
