const fs = require('fs');
let content = fs.readFileSync('./components/Sidebar.tsx', 'utf-8');

// 1. Fix /eleves/ajouter and /eleves/validation to use [...adminRoles, UserRole.SECRETARY]
content = content.replace(
  /\{hasAccess\(hrRoles\) \&\& <NavLink isSubItem icon=\{FileCheck\} item=\{\{ name: 'Validation de Dossiers', path: '\/eleves\/validation' \}\} \/>\}/,
  `{hasAccess([...adminRoles, UserRole.SECRETARY]) && <NavLink isSubItem icon={FileCheck} item={{ name: 'Validation de Dossiers', path: '/eleves/validation' }} />}`
);

content = content.replace(
  /\{hasAccess\(hrRoles\) \&\& <NavLink isSubItem icon=\{UserPlus\} item=\{\{ name: terminology\.enrollment, path: '\/eleves\/ajouter' \}\} \/>\}/,
  `{hasAccess([...adminRoles, UserRole.SECRETARY]) && <NavLink isSubItem icon={UserPlus} item={{ name: terminology.enrollment, path: '/eleves/ajouter' }} />}`
);

// 2. Fix Finance Hub (Direction Economat)
content = content.replace(
  /<NavLink isSubItem icon=\{Target\} item=\{\{ name: 'Direction Économat', path: '\/economat' \}\} \/>/,
  `{hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && <NavLink isSubItem icon={Target} item={{ name: 'Direction Économat', path: '/economat' }} />}`
);

// 3. Fix Campagnes & Evenements
content = content.replace(
  /<NavLink isSubItem icon=\{Rocket\} item=\{\{ name: 'Campagnes \& Événements', path: '\/economat\/frais-occasionnels' \}\} \/>/,
  `{hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && <NavLink isSubItem icon={Rocket} item={{ name: 'Campagnes & Événements', path: '/economat/frais-occasionnels' }} />}`
);

// 4. Direction & Rapports (Rapports & Bilans)
// The menu header already uses `[...adminRoles, UserRole.ACCOUNTANT, UserRole.SECRETARY]`
// Maybe Secretary shouldn't see it? Wait, let's check what Reports are there.
// If it's just 'Rapports & Bilans', it's /rapports.
// In Dashboard.tsx, the secretary dashboard exists. So that's okay.

fs.writeFileSync('./components/Sidebar.tsx', content);
