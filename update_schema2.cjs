const fs = require('fs');
let content = fs.readFileSync('src/types/schema.ts', 'utf8');
let firstIndex = content.indexOf('export interface BedRecord');
let secondIndex = content.indexOf('export interface BedRecord', firstIndex + 1);

if (secondIndex !== -1) {
  let endOfSecond = content.indexOf('export interface UserPermissions', secondIndex);
  content = content.substring(0, secondIndex) + content.substring(endOfSecond);
  fs.writeFileSync('src/types/schema.ts', content);
}
