import React, { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';

interface LogoProps {
  src?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Logo: React.FC<LogoProps> = ({ 
  src, 
  alt = "EduNova Logo", 
  className = "", 
  imgClassName = "",
  size = 'md' 
}) => {
  // Priorité absolue au format WebP haute performance pour le logo par défaut
  const resolveTargetSrc = (rawSrc?: string | null): string => {
    if (!rawSrc || rawSrc === '/logo.png' || rawSrc === '/logo.jpg') {
      return '/logo.webp';
    }
    return rawSrc;
  };

  const [currentSrc, setCurrentSrc] = useState<string>(resolveTargetSrc(src));
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    setCurrentSrc(resolveTargetSrc(src));
    setErrorCount(0);
  }, [src]);

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24'
  };

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 32,
    xl: 48
  };

  const roundedClasses = {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl'
  };

  const handleError = () => {
    if (errorCount === 0 && currentSrc === '/logo.webp') {
      setCurrentSrc('/logo.png');
      setErrorCount(1);
    } else if (errorCount <= 1 && currentSrc !== '/logo.png') {
      setCurrentSrc('/logo.png');
      setErrorCount(2);
    } else if (errorCount <= 2 && currentSrc !== '/logo.jpg') {
      setCurrentSrc('/logo.jpg');
      setErrorCount(3);
    } else if (errorCount <= 3 && currentSrc !== '/pwa-192x192.png') {
      setCurrentSrc('/pwa-192x192.png');
      setErrorCount(4);
    } else if (errorCount <= 4 && currentSrc !== '/favicon.png') {
      setCurrentSrc('/favicon.png');
      setErrorCount(5);
    } else {
      setErrorCount(6);
    }
  };

  const hasCustomSize = className.includes('w-') || className.includes('h-');
  const dimensionsClass = hasCustomSize ? '' : sizeClasses[size];

  if (errorCount >= 6) {
    const isSchoolName = alt && alt !== "Logo" && alt !== "EduNova Logo" && alt !== "Logo École" && alt !== "EduNova";
    const defaultLetter = isSchoolName ? alt.charAt(0).toUpperCase() : null;

    return (
      <div 
        className={`shrink-0 ${dimensionsClass} ${roundedClasses[size]} bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-800 flex items-center justify-center text-white shadow-md overflow-hidden ${className}`}
      >
        {defaultLetter ? (
          <span className="font-extrabold text-white text-lg">{defaultLetter}</span>
        ) : (
          <GraduationCap size={iconSizes[size]} className="text-white drop-shadow-sm" />
        )}
      </div>
    );
  }

  return (
    <div className={`group shrink-0 ${dimensionsClass} ${roundedClasses[size]} overflow-hidden flex items-center justify-center bg-white shadow-sm ring-1 ring-slate-200/80 transition-all duration-300 hover:scale-[1.03] hover:shadow-md hover:ring-blue-400/40 relative ${className}`}>
      <img 
        src={currentSrc} 
        alt={alt} 
        loading="eager"
        decoding="async"
        className={`w-full h-full object-contain transition-all duration-300 group-hover:scale-[1.04] ${imgClassName}`}
        onError={handleError}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default Logo;
