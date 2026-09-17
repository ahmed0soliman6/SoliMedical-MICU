const fs = require('fs');
let code = fs.readFileSync('src/components/SbarSignModal.tsx', 'utf8');

if (!code.includes('DEFAULT_SBAR_FIELDS')) {
  code = code.replace(/import \{ SystemFeatureFlags \} from '\.\.\/types\/settings\.ts';/g, "import { SystemFeatureFlags, DEFAULT_SBAR_FIELDS } from '../types/settings.ts';");
}

code = code.replace(
  "const [recommendation, setRecommendation] = useState<string>('');",
  "const [recommendation, setRecommendation] = useState<string>('');\n  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});"
);

const fieldsLogic = `
  const configuredFields = settings.sbarFields && settings.sbarFields.length > 0 ? settings.sbarFields : DEFAULT_SBAR_FIELDS;
  const hasField = (id: string) => configuredFields.some(f => f.id === id);
  const standardIds = ['situation', 'background', 'hemodynamics', 'pulmonary', 'metabolic', 'neurology', 'infectious', 'recommendation'];
  const customFieldsConfig = configuredFields.filter(f => !standardIds.includes(f.id));
`;

code = code.replace(
  "// Handle shift acknowledgment by incoming doctor",
  fieldsLogic + "\n  // Handle shift acknowledgment by incoming doctor"
);

fs.writeFileSync('src/components/SbarSignModal.tsx', code);
console.log('patched SbarSignModal state');
