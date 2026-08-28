const fs = require('fs');
let content = fs.readFileSync('./components/Dashboard.tsx', 'utf-8');

const regexPresences = /(\{isPresencesEnabled && \(\s*<Link to="\/presences".*?<\/Link>\s*\)\})/s;
content = content.replace(
  regexPresences,
  `{[UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.SECRETARY, UserRole.SUPERVISOR].includes(user.role) && isPresencesEnabled && (\n                $1\n                )}`
);
// wait the regex would capture the outer braces, let's just make it simpler

fs.writeFileSync('./components/Dashboard.tsx', content);
