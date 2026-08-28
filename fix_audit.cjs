const fs = require('fs');
let code = fs.readFileSync('components/AuditLogsView.tsx', 'utf8');

code = code.replace(
  /  const filteredLogs = logs\.filter\(log => \{/g,
  `  const filteredLogs = logs.filter(log => {
    if (currentCampusId) {
      if (log.profiles?.campus_id !== currentCampusId) return false;
    }`
);

fs.writeFileSync('components/AuditLogsView.tsx', code);
