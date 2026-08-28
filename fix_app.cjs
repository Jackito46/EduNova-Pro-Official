const fs = require('fs');
let content = fs.readFileSync('./App.tsx', 'utf-8');

// Replace financeRoles definition:
// Remove SECRETARY from financeRoles
content = content.replace(
  /const financeRoles = \[\.\.\.adminRoles, UserRole\.ACCOUNTANT, UserRole\.SECRETARY\];/,
  `const financeRoles = [...adminRoles, UserRole.ACCOUNTANT];\n  const cashierRoles = [...adminRoles, UserRole.ACCOUNTANT, UserRole.SECRETARY];`
);

// We need to change specific routes to use cashierRoles instead of financeRoles
const cashierRoutes = [
  '/economat/frais',
  '/economat/factures',
  '/economat/releves',
  '/economat/suivi',
  '/economat/debiteurs',
  '/economat/fournitures'
];

for (const route of cashierRoutes) {
  const regex = new RegExp(`(<Route path="${route}" element={<RoleGuard user=\\{user\\} allowedRoles=\{)financeRoles(\\}>)`);
  content = content.replace(regex, `$1cashierRoles$2`);
}

// Fix /economat/planification to NOT include SECRETARY (only adminRoles + ACCOUNTANT)
content = content.replace(
  /<Route path="\/economat\/planification" element=\{<RoleGuard user=\{user\} allowedRoles=\{\[\.\.\.adminRoles, UserRole\.SECRETARY\]\}><FeePlanningView user=\{user\} \/><\/RoleGuard>\} \/>/,
  `<Route path="/economat/planification" element={<RoleGuard user={user} allowedRoles={[...adminRoles, UserRole.ACCOUNTANT]}><FeePlanningView user={user} /></RoleGuard>} />`
);

// We should also check /economat (Direction Economat) which uses financeRoles. 
// With our change, financeRoles now does NOT include SECRETARY. That means they can't access /economat. This matches our Sidebar change.
// Same for /economat/frais-occasionnels which will stay financeRoles. This fixes the AdHoc campaigns issue.

// Wait, what about /economat/rapport-reductions? Let's leave it as financeRoles (no secretary).

fs.writeFileSync('./App.tsx', content);
