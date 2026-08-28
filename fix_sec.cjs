const fs = require('fs');

// Update App.tsx
let appContent = fs.readFileSync('./App.tsx', 'utf-8');

appContent = appContent.replace(
  /<Route path="\/communication\/email" element=\{<RoleGuard user=\{user\} allowedRoles=\{\[\.\.\.adminRoles, UserRole\.SECRETARY\]\}><EmailModule user=\{user\} \/><\/RoleGuard>\} \/>/,
  `<Route path="/communication/email" element={<RoleGuard user={user} allowedRoles={adminRoles}><EmailModule user={user} /></RoleGuard>} />`
);
appContent = appContent.replace(
  /<Route path="\/communication\/sms" element=\{<RoleGuard user=\{user\} allowedRoles=\{\[\.\.\.adminRoles, UserRole\.SECRETARY\]\}><SmsModule user=\{user\} \/><\/RoleGuard>\} \/>/,
  `<Route path="/communication/sms" element={<RoleGuard user={user} allowedRoles={adminRoles}><SmsModule user={user} /></RoleGuard>} />`
);
appContent = appContent.replace(
  /<Route path="\/communication\/push" element=\{<RoleGuard user=\{user\} allowedRoles=\{\[\.\.\.adminRoles, UserRole\.SECRETARY\]\}><PushModule user=\{user\} \/><\/RoleGuard>\} \/>/,
  `<Route path="/communication/push" element={<RoleGuard user={user} allowedRoles={adminRoles}><PushModule user={user} /></RoleGuard>} />`
);
appContent = appContent.replace(
  /<Route path="\/settings\/ecole" element=\{<RoleGuard user=\{user\} allowedRoles=\{\[\.\.\.adminRoles, UserRole\.SECRETARY\]\}><SettingsView user=\{user\} \/><\/RoleGuard>\} \/>/,
  `<Route path="/settings/ecole" element={<RoleGuard user={user} allowedRoles={adminRoles}><SettingsView user={user} /></RoleGuard>} />`
);
appContent = appContent.replace(
  /<Route path="\/settings\/audit" element=\{<RoleGuard user=\{user\} allowedRoles=\{\[\.\.\.adminRoles, UserRole\.SECRETARY\]\}><AuditLogsView user=\{user\} \/><\/RoleGuard>\} \/>/,
  `<Route path="/settings/audit" element={<RoleGuard user={user} allowedRoles={adminRoles}><AuditLogsView user={user} /></RoleGuard>} />`
);
fs.writeFileSync('./App.tsx', appContent);

// Update Sidebar.tsx
let sidebarContent = fs.readFileSync('./components/Sidebar.tsx', 'utf-8');
sidebarContent = sidebarContent.replace(
  /\{hasAccess\(\[\.\.\.adminRoles, UserRole\.SECRETARY\]\) \&\& \(\s*<div className="space-y-1">\s*<MenuHeader id="communication" label="Communication" icon=\{MessageSquare\} \/>/g,
  `{hasAccess(adminRoles) && (\n            <div className="space-y-1">\n              <MenuHeader id="communication" label="Communication" icon={MessageSquare} />`
);

sidebarContent = sidebarContent.replace(
  /\{\(hasAccess\(adminRoles\) \|\| user\.role === UserRole\.SECRETARY\) \&\& \(\s*<div className="space-y-1">\s*<MenuHeader id="config" label="Configuration" icon=\{Settings\} \/>/g,
  `{hasAccess(adminRoles) && (\n            <div className="space-y-1">\n              <MenuHeader id="config" label="Configuration" icon={Settings} />`
);

// We need to also remove the specific `hasAccess(adminRoles)` checks within the config menu since the whole block is now `hasAccess(adminRoles)`.
sidebarContent = sidebarContent.replace(
  /\{hasAccess\(adminRoles\) \&\& <NavLink isSubItem icon=\{School\} item=\{\{ name: 'Identité Établissement', path: '\/settings\/ecole' \}\} \/>\}/g,
  `<NavLink isSubItem icon={School} item={{ name: 'Identité Établissement', path: '/settings/ecole' }} />`
);
sidebarContent = sidebarContent.replace(
  /\{hasAccess\(adminRoles\) \&\& <NavLink isSubItem icon=\{BookOpen\} item=\{\{ name: `\$\{terminology\.classes\} \& \$\{terminology\.subjects\}`, path: '\/classes' \}\} \/>\}/g,
  `<NavLink isSubItem icon={BookOpen} item={{ name: \`\${terminology.classes} & \${terminology.subjects}\`, path: '/classes' }} />`
);
sidebarContent = sidebarContent.replace(
  /\{hasAccess\(adminRoles\) \&\& <NavLink isSubItem icon=\{UserCog\} item=\{\{ name: 'Utilisateurs', path: '\/settings\/utilisateurs' \}\} \/>\}/g,
  `<NavLink isSubItem icon={UserCog} item={{ name: 'Utilisateurs', path: '/settings/utilisateurs' }} />`
);

fs.writeFileSync('./components/Sidebar.tsx', sidebarContent);
