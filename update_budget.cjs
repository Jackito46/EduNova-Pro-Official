const fs = require('fs');
let content = fs.readFileSync('./components/BudgetPlanningView.tsx', 'utf-8');

content = content.replace(/\.select\('category, amount'\)/, `.select('amount, category_legacy, category_ref:expense_categories(label)')`);

content = content.replace(/actualsMap\[exp\.category\] = \(actualsMap\[exp\.category\] \|\| 0\) \+ exp\.amount;/g, `
        const catName = exp.category_ref?.label || exp.category_legacy || 'Autre';
        actualsMap[catName] = (actualsMap[catName] || 0) + exp.amount;`);

fs.writeFileSync('./components/BudgetPlanningView.tsx', content);
