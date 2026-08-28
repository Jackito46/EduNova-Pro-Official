const fs = require('fs');
let content = fs.readFileSync('./components/Dashboard.tsx', 'utf-8');

content = content.replace(
  /<Link to="\/messages" className="flex items-center/g,
  `<button onClick={() => alert('Module de messagerie en construction')} className="w-full flex items-center`
);

content = content.replace(
  /<ChevronRight size=\{16\} className="ml-auto text-gray-400" \/>\s*<\/Link>/g,
  `<ChevronRight size={16} className="ml-auto text-gray-400" />\n                </button>`
);

fs.writeFileSync('./components/Dashboard.tsx', content);
