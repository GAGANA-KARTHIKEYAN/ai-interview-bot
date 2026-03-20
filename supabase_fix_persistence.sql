-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- This adds the missing column needed for resume persistence on AWS Amplify

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS resume_base64 TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'resume_base64';
