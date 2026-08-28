const fs = require('fs');
let content = fs.readFileSync('./components/FinanceHub.tsx', 'utf-8');

content = content.replace(/const fetchFinanceData = useCallback\(async \(\) => \{\n    if \(\!user\?\.school_id\) return;/, `const fetchFinanceData = useCallback(async () => {
    if (!user?.school_id) return;
    const activeCampusId = user.campus_id || currentCampusId;`);

fs.writeFileSync('./components/FinanceHub.tsx', content);
