const fs = require('fs');

let code = fs.readFileSync('components/StudentPaymentTracking.tsx', 'utf8');

if (code.includes('const { terminology } = useSchool();')) {
  code = code.replace('const { terminology } = useSchool();', 'const { terminology, currentCampusId } = useSchool();');
}

code = code.replace(
  /const mappedData = data\?\.map\(\(s: any\) => \{/,
  `let searchResults = data || [];
      if (currentCampusId) {
        searchResults = searchResults.filter(s => s.campus_id === currentCampusId);
      }
      const mappedData = searchResults.map((s: any) => {`
);

fs.writeFileSync('components/StudentPaymentTracking.tsx', code);
