import React, { useState } from 'react';
import { UserProfile } from '../types';
import { useSchool } from '../contexts/SchoolContext';
import { CourseEvaluationsView } from './CourseEvaluationsView';
import SyllabusPlanningList from './SyllabusPlanningList';
import { BookOpen, Settings, LayoutList } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface SyllabusHubProps {
  user: UserProfile;
}

export default function SyllabusHub({ user }: SyllabusHubProps) {
  const { terminology } = useSchool();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const defaultTab = searchParams.has('class') && searchParams.has('subject') ? 'planning' : 'overview';
  const urlTab = searchParams.get('tab') as 'planning' | 'overview' | null;
  const initialTab = urlTab || defaultTab;
  
  const [activeTab, setActiveTab] = useState<'planning' | 'overview'>(initialTab);

  React.useEffect(() => {
    const tab = searchParams.get('tab') as 'planning' | 'overview' | null;
    if (tab) {
      setActiveTab(tab);
    } else if (searchParams.has('class') && searchParams.has('subject')) {
      setActiveTab('planning');
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'planning' | 'overview') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-300 font-sans">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <BookOpen className="text-blue-500" />
            Syllabus d'évaluations
          </h1>
          <p className="text-gray-500 mt-1">
            Gérez vos objectifs pédagogiques et suivez la progression de vos matières.
          </p>
        </div>
      </div>

      <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex max-w-md w-full">
        <button
          onClick={() => handleTabChange('planning')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${
            activeTab === 'planning' 
            ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50' 
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent'
          }`}
        >
          <Settings size={18} />
          Planificateur
        </button>
        <button
          onClick={() => handleTabChange('overview')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${
            activeTab === 'overview' 
            ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50' 
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent'
          }`}
        >
          <LayoutList size={18} />
          Suivis globaux
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'planning' && (
          <div className="-mx-4 md:-mx-6 -mt-10 md:-mt-12 lg:-mt-14">
             {/* Negative margins to align Component's own inner padding since CourseEvaluationsView handles its own max-w container */}
             <CourseEvaluationsView user={user} hideHeader />
          </div>
        )}
        {activeTab === 'overview' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             <SyllabusPlanningList user={user} />
          </div>
        )}
      </div>
    </div>
  );
}
