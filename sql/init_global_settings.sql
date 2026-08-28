
-- Create global_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS global_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public read access for global_settings" ON global_settings;
DROP POLICY IF EXISTS "Super admin full access for global_settings" ON global_settings;

-- Create policies
CREATE POLICY "Public read access for global_settings" 
ON global_settings FOR SELECT 
USING (true);

CREATE POLICY "Super admin full access for global_settings" 
ON global_settings FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'SUPER_ADMIN'
  )
);

-- Insert default system_status if it doesn't exist
INSERT INTO global_settings (key, value)
VALUES ('system_status', '{"maintenance_mode": false}')
ON CONFLICT (key) DO NOTHING;
