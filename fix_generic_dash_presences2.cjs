const fs = require('fs');
let content = fs.readFileSync('./components/Dashboard.tsx', 'utf-8');

content = content.replace(
  /\{isPresencesEnabled && \(\s*<Link to="\/presences"/g,
  `{[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.SECRETARY, UserRole.SUPERVISOR].includes(user.role) && isPresencesEnabled && (\n                  <Link to="/presences"`
);

fs.writeFileSync('./components/Dashboard.tsx', content);
