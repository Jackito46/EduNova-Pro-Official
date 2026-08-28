
import fs from 'fs';
const filePath = 'components/StaffForm.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// The line we want to replace
const searchPattern = /\.or\(`school_id\.eq\.\${user\.school_id},school_id\.is\.null`\)/;

if (searchPattern.test(content)) {
    const newContent = content.replace(searchPattern, ".or(user.school_id ? `school_id.eq.${user.school_id},school_id.is.null` : 'school_id.is.null')");
    fs.writeFileSync(filePath, newContent);
    console.log("File fixed successfully");
} else {
    console.log("Pattern not found");
}
