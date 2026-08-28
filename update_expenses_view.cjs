const fs = require('fs');
let content = fs.readFileSync('./components/ExpensesView.tsx', 'utf-8');
content = content.replace(/if \(currentCampusId\) \{\s*expensesQuery = expensesQuery\.eq\('campus_id', currentCampusId\);\s*\}/g, `const activeCampusId = user.campus_id || currentCampusId;
      if (activeCampusId) {
        expensesQuery = expensesQuery.eq('campus_id', activeCampusId);
      }`);
fs.writeFileSync('./components/ExpensesView.tsx', content);
