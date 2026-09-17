const fs = require('fs');
let code = fs.readFileSync('src/types/settings.ts', 'utf8');

const sbarFieldType = `
export interface SbarFieldConfig {
  id: string;
  labelEn: string;
  labelAr: string;
  section: 'S' | 'B' | 'A' | 'R';
  isRequired: boolean;
  order: number;
}
`;

if (!code.includes('SbarFieldConfig')) {
  code = code.replace('export interface SystemSettings {', sbarFieldType + '\nexport interface SystemSettings {\n  sbarFields?: SbarFieldConfig[];');
}

const defaultSbarFields = `
export const DEFAULT_SBAR_FIELDS: SbarFieldConfig[] = [
  { id: 'situation', labelEn: 'Situation (Patient, Bed, Diagnosis)', labelAr: 'الموقف الحالي، السرير والتشخيص', section: 'S', isRequired: true, order: 1 },
  { id: 'background', labelEn: 'Background (History, Hospital Course)', labelAr: 'الخلفية الطبية، التاريخ المرضي', section: 'B', isRequired: true, order: 2 },
  { id: 'hemodynamics', labelEn: 'Hemodynamics & Cardiovascular', labelAr: 'الدورة الدموية والقلب', section: 'A', isRequired: true, order: 3 },
  { id: 'pulmonary', labelEn: 'Pulmonary & Airway', labelAr: 'التنفس والمجرى الهوائي', section: 'A', isRequired: true, order: 4 },
  { id: 'metabolic', labelEn: 'Metabolic & Renal', labelAr: 'الأيض والكلى (السوائل)', section: 'A', isRequired: true, order: 5 },
  { id: 'neurology', labelEn: 'Neurology, Pain & Sedation', labelAr: 'الأعصاب، الألم والتهدئة', section: 'A', isRequired: true, order: 6 },
  { id: 'infectious', labelEn: 'Infectious & GI', labelAr: 'العدوى والجهاز الهضمي', section: 'A', isRequired: true, order: 7 },
  { id: 'recommendation', labelEn: 'Recommendation & Plan', labelAr: 'التوصيات والخطة العلاجية', section: 'R', isRequired: true, order: 8 },
];
`;

if (!code.includes('DEFAULT_SBAR_FIELDS')) {
  code += defaultSbarFields;
}

fs.writeFileSync('src/types/settings.ts', code);
console.log('patched settings.ts');
