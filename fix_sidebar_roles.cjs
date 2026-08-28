const fs = require('fs');
let content = fs.readFileSync('./components/Sidebar.tsx', 'utf-8');

// Replace financeRoles definition:
content = content.replace(
  /const financeRoles = \[\.\.\.adminRoles, UserRole\.ACCOUNTANT, UserRole\.SECRETARY\];/,
  `const financeRoles = [...adminRoles, UserRole.ACCOUNTANT];\n  const cashierRoles = [...adminRoles, UserRole.ACCOUNTANT, UserRole.SECRETARY];`
);

// We need to change the main Finance Menu check:
content = content.replace(
  /\{hasAccess\(financeRoles\) \&\& \(/,
  `{hasAccess(cashierRoles) && (`
);

fs.writeFileSync('./components/Sidebar.tsx', content);
