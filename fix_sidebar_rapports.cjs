const fs = require('fs');
let content = fs.readFileSync('./components/Sidebar.tsx', 'utf-8');

content = content.replace(
  /\{hasAccess\(\[\.\.\.adminRoles, UserRole\.ACCOUNTANT, UserRole\.SECRETARY\]\) \&\& \(/,
  `{hasAccess([...adminRoles, UserRole.ACCOUNTANT]) && (`
);

fs.writeFileSync('./components/Sidebar.tsx', content);
