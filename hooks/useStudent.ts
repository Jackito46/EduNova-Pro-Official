import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { UserProfile } from '../types';

export const useStudent = (user: UserProfile) => {
  const [studentData, setStudentData] = useState<any>(null);
  const [activeYear, setActiveYear] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      if (user.role !== 'STUDENT') {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        // Fetch active academic year
        const { data: allYears } = await supabase
          .from('academic_years')
          .select('*')
          .eq('school_id', user.school_id);
          
        const yearData = allYears?.find(y => y.is_active || y.status === 'ACTIVE') || allYears?.[0];
        setActiveYear(yearData || null);

        // Fetch student data
        const firstName = user.full_name?.split(' ')[0] || '';
        const lastName = user.full_name?.split(' ').slice(1).join(' ') || '';

        const filterQuery = (firstName && lastName) 
          ? `parent_email.eq."${user.email}",and(first_name.ilike."${firstName}%",last_name.ilike."%${lastName}%")`
          : `parent_email.eq."${user.email}"`;

        const { data, error: fetchError } = await supabase
          .from('students')
          .select('*, class:classes(id, name, level)')
          .or(filterQuery)
          .eq('school_id', user.school_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) throw fetchError;
        setStudentData(data);
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  return { studentData, activeYear, loading, error };
};
