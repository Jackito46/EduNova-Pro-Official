const fs = require('fs');
let content = fs.readFileSync('./components/Dashboard.tsx', 'utf-8');

content = content.replace(/to="\/messagerie"/g, 'to="/communication/email"');
content = content.replace(/to="\/payroll"/g, 'to="/economat/paie"');

fs.writeFileSync('./components/Dashboard.tsx', content);
