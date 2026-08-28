const fs = require('fs');

let content = fs.readFileSync('./components/SecretaryDashboardView.tsx', 'utf-8');

// Replace the Link block for communication
content = content.replace(
  /\s*<Link to="\/communication\/email" className="flex flex-col items-center justify-center p-4 bg-white border-2 border-slate-100 hover:border-purple-200 hover:bg-purple-50\/50 rounded-3xl transition-all group">\s*<MessageSquare size=\{24\} className="text-slate-400 group-hover:text-purple-500 mb-2 transition-colors" \/>\s*<span className="font-bold text-slate-700 group-hover:text-purple-700 text-xs text-center">Communication<\/span>\s*<\/Link>/g,
  ""
);

fs.writeFileSync('./components/SecretaryDashboardView.tsx', content);
