const fs = require('fs');

let code = fs.readFileSync('components/SyllabusPlanningList.tsx', 'utf8');

// Add currentCampusId to useSchool
if (code.includes('const { terminology } = useSchool();')) {
  code = code.replace('const { terminology } = useSchool();', 'const { terminology, currentCampusId } = useSchool();');
}

code = code.replace(
  /if \(user\.campus_id\) \{\s+classesQuery = classesQuery\.eq\('campus_id', user\.campus_id\);\s+\}/,
  `const activeCampusId = user.campus_id || currentCampusId;
      if (activeCampusId) {
         classesQuery = classesQuery.eq('campus_id', activeCampusId);
      }`
);

// find useEffect dependency array
code = code.replace(
  /}, \[user\.id, user\.school_id, user\.role, user\.campus_id\]\);/g,
  `}, [user.id, user.school_id, user.role, user.campus_id, currentCampusId]);`
);
// just in case
code = code.replace(
  /}, \[user\.id, user\.school_id, user\.role\]\);/g,
  `}, [user.id, user.school_id, user.role, currentCampusId]);`
);


fs.writeFileSync('components/SyllabusPlanningList.tsx', code);

// Same for CourseEvaluationsView if it misses dependency
let evalCode = fs.readFileSync('components/CourseEvaluationsView.tsx', 'utf8');
if (!evalCode.includes('currentCampusId]')) {
  evalCode = evalCode.replace(
    /}, \[user\.school_id, user\.id, user\.role, user\.campus_id\]\);/g,
    `}, [user.school_id, user.id, user.role, user.campus_id, currentCampusId]);`
  );
  fs.writeFileSync('components/CourseEvaluationsView.tsx', evalCode);
}

