const fs = require('fs');
let content = fs.readFileSync('./components/Dashboard.tsx', 'utf-8');

content = content.replace(
  /onClick=\{\(\) => navigate\('\/economat\/suivi', \{ state: \{ studentId: child\.id \} \}\)\}/g,
  `onClick={() => alert('Le portail de suivi financier détaillé sera bientôt disponible pour les parents.')}`
);

content = content.replace(
  /onClick=\{\(\) => navigate\(\`\/eleves\/modifier\/\$\{child\.id\}\`\)\}/g,
  `onClick={() => alert('Le portail de suivi académique détaillé sera bientôt disponible pour les parents.')}`
);

fs.writeFileSync('./components/Dashboard.tsx', content);
