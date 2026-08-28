import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div
    className={`animate-pulse bg-gradient-to-r from-slate-100 via-slate-200/70 to-slate-100 rounded-xl bg-[length:200%_100%] ${className}`}
  />
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="w-full space-y-3 p-3 md:p-5 overflow-hidden">
    <div className="hidden sm:flex items-center justify-between pb-3 border-b border-slate-100">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-20" />
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center justify-between py-2.5 space-x-3 md:space-x-4 border-b border-slate-50">
        <div className="flex items-center space-x-3 w-3/4 sm:w-1/3 shrink-0">
          <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-full shrink-0" />
          <div className="space-y-1.5 w-full">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-3.5 w-1/4 hidden sm:block" />
        <Skeleton className="h-3.5 w-1/6 hidden md:block" />
        <Skeleton className="h-7 w-16 sm:h-8 sm:w-20 rounded-lg shrink-0" />
      </div>
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-6 w-3/4 mt-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    ))}
  </div>
);

export const FluidLoadingState: React.FC<{ message?: string; subtext?: string }> = ({
  message = "Chargement des données...",
  subtext = "Veuillez patienter un instant"
}) => (
  <div className="flex flex-col items-center justify-center py-10 md:py-16 px-4 text-center w-full max-w-xl mx-auto">
    <div className="relative flex items-center justify-center mb-4 md:mb-5">
      {/* Outer pulsing aura */}
      <div className="absolute w-14 h-14 md:w-16 md:h-16 bg-blue-500/20 rounded-full animate-ping opacity-75" />
      {/* Middle rotating gradient ring */}
      <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border-3 border-transparent border-t-blue-600 border-r-indigo-600 border-b-cyan-500 animate-spin" />
      {/* Inner glowing core */}
      <div className="absolute w-7 h-7 md:w-8 md:h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
        <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-white rounded-full animate-pulse" />
      </div>
    </div>
    <motion.h4
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-sm sm:text-base font-bold text-slate-800 tracking-tight leading-snug px-2"
    >
      {message}
    </motion.h4>
    <p className="text-xs md:text-sm text-slate-400 font-medium mt-1.5 max-w-xs sm:max-w-md leading-relaxed">{subtext}</p>
  </div>
);

export const ModernRegistrySkeleton: React.FC<{ 
  title?: string;
  subtitle?: string;
  rows?: number;
  type?: 'table' | 'cards';
}> = ({ 
  title = "Chargement du registre en cours...", 
  subtitle = "Connexion sécurisée avec la base de données...",
  rows = 6,
  type = 'table'
}) => (
  <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
    {/* Banner Skeleton */}
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4 w-full md:w-auto">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/20 flex items-center justify-center animate-pulse shrink-0">
          <div className="w-6 h-6 rounded-lg bg-indigo-400/40" />
        </div>
        <div className="space-y-2 w-full">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold text-indigo-300 tracking-wider uppercase">{title}</span>
          </div>
          <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 w-full md:w-auto">
        <Skeleton className="h-10 w-28 bg-slate-800/80 rounded-2xl" />
        <Skeleton className="h-10 w-36 bg-indigo-600/40 rounded-2xl" />
      </div>
    </div>

    {/* Filter bar Skeleton */}
    <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
      <Skeleton className="h-11 w-full md:w-80 rounded-2xl" />
      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
        <Skeleton className="h-10 w-28 rounded-2xl" />
        <Skeleton className="h-10 w-28 rounded-2xl" />
        <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
      </div>
    </div>

    {/* Content Skeleton */}
    {type === 'table' ? (
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-slate-50 gap-4">
            <div className="flex items-center space-x-3.5 w-2/5">
              <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
              <div className="space-y-2 w-full">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="h-8 w-24 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    ) : (
      <SkeletonCard count={rows} />
    )}
  </div>
);

export const ModernDashboardSkeleton: React.FC<{
  title?: string;
  subtitle?: string;
}> = ({
  title = "Initialisation du Tableau de Bord...",
  subtitle = "Chargement sécurisé des indicateurs clés, finances et données académiques en temps réel..."
}) => (
  <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto w-full p-4 md:p-8">
    {/* Light White Card Header with Fluid Loading State */}
    <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
      <FluidLoadingState message={title} subtext={subtitle} />
    </div>

    {/* 4 Bento KPI Cards Skeletons */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-11 bg-indigo-50/80 rounded-2xl shrink-0" />
          </div>
          <div className="space-y-2 pt-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>

    {/* Charts & Details Skeletons */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
        <div className="h-64 flex items-end justify-between gap-3 pt-6 border-t border-slate-100">
          {[40, 65, 30, 85, 50, 70, 90, 60, 75, 45, 80, 55].map((h, idx) => (
            <div key={idx} className="flex-1 bg-gradient-to-t from-indigo-100/60 to-slate-100 rounded-t-xl animate-pulse" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
        <Skeleton className="h-5 w-36" />
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((j) => (
            <div key={j} className="w-full h-12 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center px-4 justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
                <Skeleton className="h-3.5 w-28" />
              </div>
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const SubmittingButtonContent: React.FC<{ label: string; icon?: React.ReactNode }> = ({ label, icon }) => (
  <span className="flex items-center justify-center gap-2">
    <span className="relative flex items-center justify-center w-4 h-4">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
    </span>
    <span className="font-bold">{label}</span>
  </span>
);
