const fs = require('fs');
let content = fs.readFileSync('./components/Dashboard.tsx', 'utf-8');

// Remove onClick={() => navigate('/economat/suivi', { state: { studentId: child.id } })}
content = content.replace(
  /onClick=\{.*?navigate\('\/economat\/suivi'.*?\}/g,
  `onClick={() => alert('Le portail de suivi financier détaillé sera bientôt disponible pour les parents.')}`
);

// Remove onClick={() => navigate(`/eleves/modifier/${child.id}`)}
content = content.replace(
  /onClick=\{.*?navigate\(\`\/eleves\/modifier.*?\}\}/g,
  `onClick={() => alert('Le portail de suivi académique détaillé sera bientôt disponible pour les parents.')}`
);

// Espace Parent section - Mes Factures & Reçus
content = content.replace(
  /<Link to="\/economat\/factures" className="flex items-center/g,
  `<button onClick={() => alert('Module en construction')} className="w-full flex items-center`
);
content = content.replace(
  /<Link to="\/horaire" className="flex items-center/g,
  `<button onClick={() => alert('Module en construction')} className="w-full flex items-center`
);

// Ensure closing tags are button instead of Link
content = content.replace(
  /<ChevronRight size=\{16\} className="ml-auto text-gray-400" \/>\s*<\/Link>/g,
  `<ChevronRight size={16} className="ml-auto text-gray-400" />\n                </button>`
);


fs.writeFileSync('./components/Dashboard.tsx', content);
