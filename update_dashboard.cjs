const fs = require('fs');
let content = fs.readFileSync('./components/Dashboard.tsx', 'utf-8');

content = content.replace(/if \(currentCampusId\) \{/g, `const activeCampusId = user.campus_id || currentCampusId;
      if (activeCampusId) {`);
      
content = content.replace(/\.eq\('campus_id', currentCampusId\)/g, `.eq('campus_id', activeCampusId)`);

fs.writeFileSync('./components/Dashboard.tsx', content);
