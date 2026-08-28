const fs = require('fs');
let content = fs.readFileSync('./components/BudgetPlanningView.tsx', 'utf-8');
content = content.replace(/if \(currentCampusId\) \{\s*budgetQuery = budgetQuery\.eq\('campus_id', currentCampusId\);\s*\} else \{\s*budgetQuery = budgetQuery\.is\('campus_id', null\);\s*\}/g, `const activeCampusId = user.campus_id || currentCampusId;
      if (activeCampusId) {
        budgetQuery = budgetQuery.eq('campus_id', activeCampusId);
      } else {
        budgetQuery = budgetQuery.is('campus_id', null);
      }`);

content = content.replace(/if \(currentCampusId\) \{\s*expenseQuery = expenseQuery\.eq\('campus_id', currentCampusId\);\s*\}/g, `if (activeCampusId) {
        expenseQuery = expenseQuery.eq('campus_id', activeCampusId);
      }`);

content = content.replace(/campus_id: currentCampusId \|\| null,/g, `campus_id: user.campus_id || currentCampusId || null,`);
fs.writeFileSync('./components/BudgetPlanningView.tsx', content);
