const fs = require('fs');
let content = fs.readFileSync('./components/BudgetPlanningView.tsx', 'utf-8');

content = content.replace(/exp\.category_ref\?\.label/g, `(Array.isArray(exp.category_ref) ? exp.category_ref[0]?.label : (exp.category_ref as any)?.label)`);

fs.writeFileSync('./components/BudgetPlanningView.tsx', content);
