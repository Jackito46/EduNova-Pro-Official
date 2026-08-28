const fs = require('fs');

let content = fs.readFileSync('./components/Dashboard.tsx', 'utf-8');

const regexElevesAjouter = /(<Link to="\/eleves\/ajouter"[\s\S]*?<\/Link>)/;
content = content.replace(
  regexElevesAjouter,
  `{[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.SECRETARY].includes(user.role) && (\n                $1\n                )}`
);

const regexFrais = /(<Link to="\/economat\/frais"[\s\S]*?<\/Link>)/;
content = content.replace(
  regexFrais,
  `{[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.SECRETARY].includes(user.role) && (\n                $1\n                )}`
);

const regexFournitures = /(<Link to="\/economat\/fournitures"[\s\S]*?<\/Link>)/;
content = content.replace(
  regexFournitures,
  `{[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.SECRETARY].includes(user.role) && (\n                $1\n                )}`
);

const regexMessagerie = /(<Link to="\/messagerie"[\s\S]*?<\/Link>)/;
content = content.replace(
  regexMessagerie,
  `{[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR].includes(user.role) && (\n                <Link to="/communication/email" className="flex items-center p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group">\n                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-100 transition-colors shrink-0">\n                    <MessageSquare size={18} />\n                  </div>\n                  <div className="ml-3 min-w-0 flex-1">\n                    <p className="text-sm font-medium text-gray-900 truncate">Communication</p>\n                    <p className="text-xs text-gray-500 truncate">Envoyer message</p>\n                  </div>\n                  <ChevronRight size={16} className="ml-auto text-gray-400 group-hover:text-gray-600 shrink-0" />\n                </Link>\n                )}`
);

const regexPayroll = /(<Link to="\/payroll"[\s\S]*?<\/Link>)/;
content = content.replace(
  regexPayroll,
  `{[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT].includes(user.role) && (\n                <Link to="/economat/paie" className="flex items-center p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group">\n                  <div className="p-2 bg-rose-50 rounded-lg text-rose-600 group-hover:bg-rose-100 transition-colors">\n                    <HandCoins size={18} />\n                  </div>\n                  <div className="ml-4">\n                    <p className="text-sm font-medium text-gray-900">Avances Payroll</p>\n                    <p className="text-xs text-gray-500">Gérer les demandes d'avances</p>\n                  </div>\n                  <ChevronRight size={16} className="ml-auto text-gray-400 group-hover:text-gray-600" />\n                </Link>\n                )}`
);

const regexEleves = /(<Link to="\/eleves" className="p-4 rounded-xl border border-gray-100[\s\S]*?<\/Link>)/;
content = content.replace(
  regexEleves,
  `{[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.SECRETARY, UserRole.SUPERVISOR].includes(user.role) && (\n                $1\n                )}`
);

const regexSuivi = /(<Link to="\/economat\/suivi" className="p-4 rounded-xl border border-gray-100[\s\S]*?<\/Link>)/;
content = content.replace(
  regexSuivi,
  `{[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.SECRETARY].includes(user.role) && (\n                $1\n                )}`
);

content = content.replace(
  /\{isPresencesEnabled && \(\s*<Link to="\/presences"/g,
  `{[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.SECRETARY, UserRole.SUPERVISOR].includes(user.role) && isPresencesEnabled && (\n                  <Link to="/presences"`
);

fs.writeFileSync('./components/Dashboard.tsx', content);
