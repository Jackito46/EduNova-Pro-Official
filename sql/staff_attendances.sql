-- Create staff_attendances table
CREATE TABLE IF NOT EXISTS staff_attendances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  staff_id UUID REFERENCES users(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES teacher_assignments(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('Présent', 'Absent', 'Retard')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Add unique constraint to prevent duplicate attendance records for the same staff/assignment/date
ALTER TABLE staff_attendances ADD CONSTRAINT unique_staff_attendance UNIQUE (staff_id, assignment_id, date);

-- Enable RLS
ALTER TABLE staff_attendances ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all authenticated users" ON staff_attendances
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON staff_attendances
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON staff_attendances
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON staff_attendances
  FOR DELETE USING (auth.role() = 'authenticated');
