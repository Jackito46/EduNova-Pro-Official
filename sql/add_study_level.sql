-- Add max_level to classes
ALTER TABLE public.classes ADD COLUMN max_level INTEGER DEFAULT 4;

-- Add study_level to enrollments
ALTER TABLE public.enrollments ADD COLUMN study_level INTEGER DEFAULT 1;

-- Also update types locally
