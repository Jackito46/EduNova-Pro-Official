-- Setup Google SMTP configuration for the main school
DO $$
DECLARE
  v_school_id UUID := 'a0ed9087-0554-40ae-ac26-86599a183b16';
BEGIN
  -- Ensure the settings record exists
  INSERT INTO public.communication_settings (
    school_id,
    email_from_name,
    email_from_address,
    smtp_host,
    smtp_port,
    smtp_user,
    smtp_pass,
    updated_at
  ) VALUES (
    v_school_id,
    'Direction EduNova Pro',
    'infostarstech2010@gmail.com',
    'smtp.gmail.com',
    587,
    'infostarstech2010@gmail.com',
    '', -- User must provide App Password
    NOW()
  )
  ON CONFLICT (school_id) DO UPDATE SET
    email_from_name = EXCLUDED.email_from_name,
    email_from_address = EXCLUDED.email_from_address,
    smtp_host = EXCLUDED.smtp_host,
    smtp_port = EXCLUDED.smtp_port,
    smtp_user = EXCLUDED.smtp_user,
    updated_at = NOW();

  RAISE NOTICE 'Google SMTP configuration prepared for school %', v_school_id;
END $$;
