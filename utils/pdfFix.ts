/**
 * Utility to fix html2canvas issues with modern color functions (OKLCH, OKLAB) used in Tailwind CSS v4.
 * It translates known Tailwind classes to explicit inline styles (resolved to hex/rgba),
 * and aggressively replaces modern color functions in <style> tags to prevent html2canvas from crashing.
 */

const PALETTE: Record<string, Record<string, string>> = {
  slate: { '50': '#f8fafc', '100': '#f1f5f9', '200': '#e2e8f0', '300': '#cbd5e1', '400': '#94a3b8', '500': '#64748b', '600': '#475569', '700': '#334155', '800': '#1e293b', '900': '#0f172a', '950': '#020617' },
  gray: { '50': '#f9fafb', '100': '#f3f4f6', '200': '#e5e7eb', '300': '#d1d5db', '400': '#9ca3af', '500': '#6b7280', '600': '#4b5563', '700': '#374151', '800': '#1f2937', '900': '#111827', '950': '#030712' },
  blue: { '50': '#eff6ff', '100': '#dbeafe', '200': '#bfdbfe', '300': '#93c5fd', '400': '#60a5fa', '500': '#3b82f6', '600': '#2563eb', '700': '#1d4ed8', '800': '#1e40af', '900': '#1e3a8a', '950': '#172554' },
  indigo: { '50': '#eef2ff', '100': '#e0e7ff', '200': '#c7d2fe', '300': '#a5b4fc', '400': '#818cf8', '500': '#6366f1', '600': '#4f46e5', '700': '#4338ca', '800': '#3730a3', '900': '#312e81', '950': '#1e1b4b' },
  emerald: { '50': '#ecfdf5', '100': '#d1fae5', '200': '#a7f3d0', '300': '#6ee7b7', '400': '#34d399', '500': '#10b981', '600': '#059669', '700': '#047857', '800': '#065f46', '900': '#064e3b', '950': '#022c22' },
  green: { '50': '#f0fdf4', '100': '#dcfce7', '200': '#bbf7d0', '300': '#86efac', '400': '#4ade80', '500': '#22c55e', '600': '#16a34a', '700': '#15803d', '800': '#166534', '900': '#14532d', '950': '#052e16' },
  rose: { '50': '#fff1f2', '100': '#ffe4e6', '200': '#fecdd3', '300': '#fda4af', '400': '#fb7185', '500': '#f43f5e', '600': '#e11d48', '700': '#be123c', '800': '#9f1239', '900': '#881337', '950': '#4c0519' },
  amber: { '50': '#fffbeb', '100': '#fef3c7', '200': '#fde68a', '300': '#fcd34d', '400': '#fbbf24', '500': '#f59e0b', '600': '#d97706', '700': '#b45309', '800': '#92400e', '900': '#78350f', '950': '#451a03' },
  red: { '50': '#fef2f2', '100': '#fee2e2', '200': '#fecaca', '300': '#fca5a5', '400': '#f87171', '500': '#ef4444', '600': '#dc2626', '700': '#b91c1c', '800': '#991b1b', '900': '#7f1d1d', '950': '#450a0a' },
};

function hexToRgbaString(hex: string, opacity: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function resolveTailwindClass(cls: string, prefix: 'bg' | 'text' | 'border'): string | null {
   if (cls === `${prefix}-white`) return '#ffffff';
   if (cls === `${prefix}-black`) return '#000000';
   if (cls === `${prefix}-transparent`) return 'transparent';

   const regex = new RegExp(`^${prefix}-([a-z]+)-(\\d+)(?:\\/(\\d+))?$`);
   const match = cls.match(regex);
   if (!match) return null;
   
   const family = match[1];
   const shade = match[2];
   const opacity = match[3] ? parseInt(match[3]) / 100 : 1;
   
   if (PALETTE[family] && PALETTE[family][shade]) {
       const hex = PALETTE[family][shade];
       if (opacity < 1) {
           return hexToRgbaString(hex, opacity);
       }
       return hex;
   }
   return null;
}

export const fixOklchForCanvas = (clonedDoc: Document) => {
  const colorMixRegex = /color-mix\s*\((?:[^()]+|\((?:[^()]+|\((?:[^()]+|\([^()]*\))*\))*\))*\)/gi;
  const colorRegex = /(oklch|oklab)\s*\((?:[^()]+|\((?:[^()]+|\((?:[^()]+|\([^()]*\))*\))*\))*\)/gi;
  
  const processCssText = (css: string, fallback: string) => {
    let result = css.replace(/\/\*[\s\S]*?\*\//g, '');
    result = result.replace(/@import\s+[^;]+;/gi, '');
    result = result.replace(colorMixRegex, fallback);
    result = result.replace(colorRegex, fallback);
    return result;
  };
  
  try {
    // 1. Explicitly Map Tailwind Colors over inline styles
    const allElements = Array.from(clonedDoc.querySelectorAll('*')) as HTMLElement[];
    allElements.forEach(el => {
       if (el.classList) {
           el.classList.forEach(cls => {
               if (cls.startsWith('bg-')) {
                   const color = resolveTailwindClass(cls, 'bg');
                   if (color) el.style.backgroundColor = color;
               } else if (cls.startsWith('text-')) {
                   const color = resolveTailwindClass(cls, 'text');
                   if (color) el.style.color = color;
               } else if (cls.startsWith('border-')) {
                   const color = resolveTailwindClass(cls, 'border');
                   if (color) el.style.borderColor = color;
               }
           });
       }
       
       // Handle standard inline styles if they happen to have color-mix/oklch directly
       const styleAttr = el.getAttribute('style');
       if (styleAttr && (styleAttr.includes('oklch') || styleAttr.includes('oklab') || styleAttr.includes('color-mix'))) {
         el.setAttribute('style', processCssText(styleAttr, 'transparent'));
       }

       // Handle SVG fills strokes
       ['fill', 'stroke', 'stop-color', 'flood-color'].forEach(attr => {
         const val = el.getAttribute(attr);
         if (val && (val.includes('oklch') || val.includes('oklab') || val.includes('color-mix'))) {
           el.setAttribute(attr, 'currentColor'); // Good fallback for SVGs
         }
       });
    });

    // 2. Destructively purge unsupported modern features from <style> tags
    const styleTags = Array.from(clonedDoc.getElementsByTagName('style'));
    styleTags.forEach(style => {
      try {
        if (style.textContent && (style.textContent.includes('oklch') || style.textContent.includes('oklab') || style.textContent.includes('color-mix'))) {
          // Replace with 'transparent' since html2canvas would crash, our inline styles will override anyway.
          style.textContent = processCssText(style.textContent, 'transparent');
        }
      } catch (e) {}
    });

    // 3. Remove unsupported external stylesheets but PRESERVE fonts
    const linkTags = Array.from(clonedDoc.getElementsByTagName('link'));
    linkTags.forEach(link => {
      const href = link.href || '';
      if ((link.rel === 'stylesheet' || link.as === 'style') && !href.includes('fonts.googleapis.com') && !href.includes('fonts.gstatic.com')) {
        try { link.remove(); } catch (e) {}
      }
    });

    // 4. Force font metrics stability and overflow safety
    if (clonedDoc.body) {
      clonedDoc.body.style.fontFamily = `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
      clonedDoc.body.style.letterSpacing = 'normal';
      clonedDoc.body.style.wordSpacing = 'normal';
    }

    // Ensure all table cells and text blocks don't clip text
    const textEls = Array.from(clonedDoc.querySelectorAll('p, td, th, h1, h2, h3, h4, span')) as HTMLElement[];
    textEls.forEach(el => {
      el.style.letterSpacing = 'normal';
      if (el.style.overflow === 'hidden') {
        el.style.overflow = 'visible';
      }
    });

  } catch (err) {
    console.warn('fixOklchForCanvas encountered an error:', err);
  }
};
