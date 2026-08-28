
-- Add sender_name column to communication_logs
ALTER TABLE public.communication_logs ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255);

-- Update existing logs with the sender's full name from profiles
UPDATE public.communication_logs l
SET sender_name = p.full_name
FROM public.profiles p
WHERE l.sender_id = p.id AND l.sender_name IS NULL;
