import React, { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import { isLocalDeploymentMode } from '../supabase';

interface LogoProps {
  src?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const LOGO_CACHE_PREFIX = 'edunova_cached_logo_img::';

const isRemoteHttpUrl = (value?: string | null): value is string =>
  Boolean(value && (value.startsWith('http://') || value.startsWith('https://')));

const readCachedLogoDataUrl = (url: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(`${LOGO_CACHE_PREFIX}${url}`);
  } catch {
    return null;
  }
};

const cacheRemoteLogoInBackground = (url: string) => {
  if (typeof window === 'undefined' || !isRemoteHttpUrl(url)) return;
  if (readCachedLogoDataUrl(url)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  void fetch(url, { mode: 'cors', cache: 'force-cache' })
    .then((res) => (res.ok ? res.blob() : null))
    .then((blob) => {
      if (!blob || blob.size > 350 * 1024) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
          try {
            window.localStorage.setItem(`${LOGO_CACHE_PREFIX}${url}`, reader.result);
          } catch {}
        }
      };
      reader.readAsDataURL(blob);
    })
    .catch(() => {});
};

const Logo: React.FC<LogoProps> = ({ 
  src, 
  alt = "EduNova Logo", 
  className = "", 
  imgClassName = "",
  size = 'md' 
}) => {
  // Priorité absolue au format WebP haute performance pour le logo par défaut,
  // et réutilisation du cache hors-ligne local si le logo distant a déjà été mis en cache.
  const resolveTargetSrc = (rawSrc?: string | null): string => {
    if (!rawSrc || rawSrc === '/logo.png' || rawSrc === '/logo.jpg') {
      return '/logo.webp';
    }
    if (isRemoteHttpUrl(rawSrc)) {
      const cached = readCachedLogoDataUrl(rawSrc);
      if (cached && (isLocalDeploymentMode() || (typeof navigator !== 'undefined' && navigator.onLine === false))) {
        return cached;
      }
    }
    return rawSrc;
  };

  const [currentSrc, setCurrentSrc] = useState<string>(() => resolveTargetSrc(src));
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

  const handleLoad = () => {
    if (isRemoteHttpUrl(currentSrc)) {
      cacheRemoteLogoInBackground(currentSrc);
    }
  };

  const handleError = () => {
    // Si une URL distante échoue (ex: Mode Local sans Internet), tenter d'abord son cache local Data URL
    if (errorCount === 0 && isRemoteHttpUrl(currentSrc)) {
      const cached = readCachedLogoDataUrl(currentSrc);
      if (cached && cached !== currentSrc) {
        setCurrentSrc(cached);
        setErrorCount(1);
        return;
      }
      setCurrentSrc('/logo.webp');
      setErrorCount(1);
      return;
    }

    if (errorCount <= 1 && currentSrc === '/logo.webp') {
      setCurrentSrc('/logo.png');
      setErrorCount(2);
    } else if (errorCount <= 2 && currentSrc !== '/logo.png') {
      setCurrentSrc('/logo.png');
      setErrorCount(3);
    } else if (errorCount <= 3 && currentSrc !== '/logo.jpg') {
      setCurrentSrc('/logo.jpg');
      setErrorCount(4);
    } else if (errorCount <= 4 && currentSrc !== '/pwa-192x192.png') {
      setCurrentSrc('/pwa-192x192.png');
      setErrorCount(5);
    } else if (errorCount <= 5 && currentSrc !== '/favicon.png') {
      setCurrentSrc('/favicon.png');
      setErrorCount(6);
    } else {
      setErrorCount(7);
    }
  };

  const hasCustomSize = className.includes('w-') || className.includes('h-');
  const dimensionsClass = hasCustomSize ? '' : sizeClasses[size];

  if (errorCount >= 7) {
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
        onLoad={handleLoad}
        onError={handleError}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default Logo;
