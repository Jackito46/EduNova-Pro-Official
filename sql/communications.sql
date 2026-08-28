-- Table for communication logs (Email and SMS)
CREATE TABLE IF NOT EXISTS public.communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id),
    type VARCHAR(10) NOT NULL CHECK (type IN ('email', 'sms')),
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('parents', 'teachers', 'students', 'individual')),
    recipient_count INTEGER NOT NULL DEFAULT 0,
    subject VARCHAR(255), -- Nullable for SMS
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for individual recipients
CREATE TABLE IF NOT EXISTS public.communication_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id UUID NOT NULL REFERENCES public.communication_logs(id) ON DELETE CASCADE,
    recipient_id UUID, -- Can be student_id or staff_id
    recipient_name VARCHAR(255),
    recipient_contact VARCHAR(255), -- email address or phone number
    status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for communication settings
CREATE TABLE IF NOT EXISTS public.communication_settings (
    school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    email_from_name VARCHAR(255),
    email_from_address VARCHAR(255),
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_user VARCHAR(255),
    smtp_pass TEXT, -- Should be handled carefully
    sms_provider VARCHAR(50), -- 'twilio', 'infobip', etc.
    sms_api_key TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors on re-run
DROP POLICY IF EXISTS "Users can view communication logs of their school" ON public.communication_logs;
DROP POLICY IF EXISTS "Users can insert communication logs for their school" ON public.communication_logs;
DROP POLICY IF EXISTS "Users can view communication recipients of their school" ON public.communication_recipients;
DROP POLICY IF EXISTS "Users can insert communication recipients for their school" ON public.communication_recipients;
DROP POLICY IF EXISTS "Users can view communication settings of their school" ON public.communication_settings;
DROP POLICY IF EXISTS "Admins can manage communication settings of their school" ON public.communication_settings;

-- Policy: Users can see logs from their own school
CREATE POLICY "Users can view communication logs of their school"
ON public.communication_logs FOR SELECT
USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));

-- Policy: Users can insert logs for their own school
CREATE POLICY "Users can insert communication logs for their school"
ON public.communication_logs FOR INSERT
WITH CHECK (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));

-- Similar policies for recipients
CREATE POLICY "Users can view communication recipients of their school"
ON public.communication_recipients FOR SELECT
USING (log_id IN (SELECT id FROM public.communication_logs WHERE school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert communication recipients for their school"
ON public.communication_recipients FOR INSERT
WITH CHECK (log_id IN (SELECT id FROM public.communication_logs WHERE school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())));

-- Policies for settings
CREATE POLICY "Users can view communication settings of their school"
ON public.communication_settings FOR SELECT
USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage communication settings of their school"
ON public.communication_settings FOR ALL
USING (school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid() AND role IN ('SCHOOL_ADMIN', 'DIRECTOR')));

-- Grant permissions
GRANT ALL ON public.communication_logs TO authenticated;
GRANT ALL ON public.communication_recipients TO authenticated;
GRANT ALL ON public.communication_settings TO authenticated;
GRANT ALL ON public.communication_logs TO service_role;
GRANT ALL ON public.communication_recipients TO service_role;
GRANT ALL ON public.communication_settings TO service_role;
