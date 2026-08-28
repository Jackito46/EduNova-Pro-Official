DO $$
BEGIN
    DELETE FROM school_supplies p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM students s WHERE s.id = p.student_id);
    DELETE FROM grades p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM students s WHERE s.id = p.student_id);
    DELETE FROM enrollments p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM students s WHERE s.id = p.student_id);
    DELETE FROM student_attendances p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM students s WHERE s.id = p.student_id);
    DELETE FROM disciplinary_records p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM students s WHERE s.id = p.student_id);
    DELETE FROM student_ad_hoc_fees p WHERE p.student_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM students s WHERE s.id = p.student_id);
END $$;
