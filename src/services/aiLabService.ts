export interface ScannedLabItem {
  testName: string;
  category: string;
  value: string;
  unit: string;
  normalRange: string;
  flag?: string;
}

export interface ScannedLabResponse {
  detectedType: 'ABG' | 'CBC' | 'CHEMISTRY_ELECTROLYTES' | 'COAGULATION' | 'CARDIAC' | 'COMPREHENSIVE';
  confidence: number;
  summaryEn: string;
  summaryAr: string;
  sampleDate?: string;
  patientName?: string;
  mrn?: string;
  statFields: Record<string, string>;
  items: ScannedLabItem[];
}

export async function scanLabImage(
  imageBase64: string,
  mimeType = 'image/jpeg',
  expectedType: 'ABG' | 'CBC' | 'ALL' | string = 'ALL'
): Promise<ScannedLabResponse> {
  const response = await fetch('/api/ai/scan-lab', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64,
      mimeType,
      expectedType,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server responded with status ${response.status}`);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to parse lab results');
  }

  return result.data as ScannedLabResponse;
}

// Generate realistic SVG-based data-URL samples of medical analyzer printouts for live testing
export function generateSampleAbgImage(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="850" viewBox="0 0 600 850" style="background:#f4f3ec; font-family:monospace, 'Courier New', Courier;">
    <rect width="600" height="850" fill="#fcfbf7" stroke="#ded8c7" stroke-width="3"/>
    <line x1="20" y1="60" x2="580" y2="60" stroke="#b0a894" stroke-dasharray="4"/>
    <text x="300" y="40" text-anchor="middle" font-size="20" font-weight="bold" fill="#1e293b">ABL 900 FLEX - BLOOD GAS ANALYZER</text>
    <text x="300" y="85" text-anchor="middle" font-size="14" fill="#64748b">MICU CENTRAL LAB REPORT | STAT ANALYSIS</text>
    
    <text x="40" y="125" font-size="13" fill="#334155">Patient ID : ICU-B01-4492</text>
    <text x="350" y="125" font-size="13" fill="#334155">Sample Type : Arterial</text>
    <text x="40" y="150" font-size="13" fill="#334155">Date/Time  : 2026-09-15 08:30</text>
    <text x="350" y="150" font-size="13" fill="#334155">Temp / FiO2 : 37.0 C / 50%</text>

    <line x1="40" y1="175" x2="560" y2="175" stroke="#cbd5e1" stroke-width="2"/>
    <text x="40" y="200" font-size="15" font-weight="bold" fill="#0f172a">PARAMETER</text>
    <text x="240" y="200" font-size="15" font-weight="bold" fill="#0f172a">VALUE</text>
    <text x="380" y="200" font-size="15" font-weight="bold" fill="#0f172a">REF. RANGE</text>
    <text x="500" y="200" font-size="15" font-weight="bold" fill="#0f172a">UNIT</text>
    <line x1="40" y1="210" x2="560" y2="210" stroke="#cbd5e1" stroke-width="1"/>

    <!-- pH -->
    <text x="40" y="245" font-size="14" font-weight="bold" fill="#0f172a">pH</text>
    <text x="240" y="245" font-size="16" font-weight="bold" fill="#dc2626">7.24 (L)</text>
    <text x="380" y="245" font-size="14" fill="#64748b">7.35 - 7.45</text>
    <text x="500" y="245" font-size="14" fill="#64748b">-</text>

    <!-- pCO2 -->
    <text x="40" y="285" font-size="14" font-weight="bold" fill="#0f172a">pCO2</text>
    <text x="240" y="285" font-size="16" font-weight="bold" fill="#dc2626">54.0 (H)</text>
    <text x="380" y="285" font-size="14" fill="#64748b">35.0 - 45.0</text>
    <text x="500" y="285" font-size="14" fill="#64748b">mmHg</text>

    <!-- pO2 -->
    <text x="40" y="325" font-size="14" font-weight="bold" fill="#0f172a">pO2</text>
    <text x="240" y="325" font-size="16" font-weight="bold" fill="#dc2626">68.5 (L)</text>
    <text x="380" y="325" font-size="14" fill="#64748b">80.0 - 100.0</text>
    <text x="500" y="325" font-size="14" fill="#64748b">mmHg</text>

    <!-- HCO3 -->
    <text x="40" y="365" font-size="14" font-weight="bold" fill="#0f172a">HCO3 (act)</text>
    <text x="240" y="365" font-size="16" font-weight="bold" fill="#dc2626">18.2 (L)</text>
    <text x="380" y="365" font-size="14" fill="#64748b">22.0 - 26.0</text>
    <text x="500" y="365" font-size="14" fill="#64748b">mmol/L</text>

    <!-- Base Excess -->
    <text x="40" y="405" font-size="14" font-weight="bold" fill="#0f172a">Base Excess</text>
    <text x="240" y="405" font-size="16" font-weight="bold" fill="#dc2626">-5.8 (L)</text>
    <text x="380" y="405" font-size="14" fill="#64748b">-2.0 - +2.0</text>
    <text x="500" y="405" font-size="14" fill="#64748b">mmol/L</text>

    <!-- Lactate -->
    <text x="40" y="445" font-size="14" font-weight="bold" fill="#0f172a">cLac (Lactate)</text>
    <text x="240" y="445" font-size="16" font-weight="bold" fill="#b91c1c">3.80 (H!)</text>
    <text x="380" y="445" font-size="14" fill="#64748b">0.50 - 2.00</text>
    <text x="500" y="445" font-size="14" fill="#64748b">mmol/L</text>

    <!-- sO2 -->
    <text x="40" y="485" font-size="14" font-weight="bold" fill="#0f172a">sO2 (Sat)</text>
    <text x="240" y="485" font-size="16" font-weight="bold" fill="#dc2626">91.2 %</text>
    <text x="380" y="485" font-size="14" fill="#64748b">95.0 - 99.0</text>
    <text x="500" y="485" font-size="14" fill="#64748b">%</text>

    <!-- Electrolytes from blood gas -->
    <line x1="40" y1="515" x2="560" y2="515" stroke="#cbd5e1" stroke-width="1"/>
    <text x="40" y="540" font-size="13" font-weight="bold" fill="#475569">CO-OXIMETRY &amp; ELECTROLYTES</text>

    <text x="40" y="575" font-size="14" fill="#0f172a">cNa+ (Sodium)</text>
    <text x="240" y="575" font-size="15" fill="#0f172a">137.0</text>
    <text x="380" y="575" font-size="14" fill="#64748b">135 - 145</text>
    <text x="500" y="575" font-size="14" fill="#64748b">mmol/L</text>

    <text x="40" y="615" font-size="14" fill="#0f172a">cK+ (Potassium)</text>
    <text x="240" y="615" font-size="15" fill="#0f172a">4.20</text>
    <text x="380" y="615" font-size="14" fill="#64748b">3.5 - 5.0</text>
    <text x="500" y="615" font-size="14" fill="#64748b">mmol/L</text>

    <text x="40" y="655" font-size="14" fill="#0f172a">cCa2+ (Ionized Ca)</text>
    <text x="240" y="655" font-size="15" fill="#0f172a">1.18</text>
    <text x="380" y="655" font-size="14" fill="#64748b">1.15 - 1.29</text>
    <text x="500" y="655" font-size="14" fill="#64748b">mmol/L</text>

    <line x1="40" y1="700" x2="560" y2="700" stroke="#cbd5e1" stroke-dasharray="4"/>
    <text x="300" y="740" text-anchor="middle" font-size="13" fill="#64748b">OPERATOR: Dr. ICU Resident | SIGNED &amp; VERIFIED</text>
    <text x="300" y="765" text-anchor="middle" font-size="12" fill="#94a3b8">*** CRITICAL ALERT: Combined Metabolic Acidosis + Hyperlactatemia ***</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

export function generateSampleCbcImage(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="850" viewBox="0 0 600 850" style="background:#ffffff; font-family:Arial, sans-serif;">
    <rect width="600" height="850" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <rect x="0" y="0" width="600" height="80" fill="#0f172a"/>
    <text x="300" y="45" text-anchor="middle" font-size="20" font-weight="bold" fill="#38bdf8">HAEMATOLOGY LABORATORY REPORT</text>
    <text x="300" y="68" text-anchor="middle" font-size="13" fill="#94a3b8">AUTOMATED CBC WITH 5-PART DIFFERENTIAL</text>

    <rect x="25" y="95" width="550" height="65" rx="6" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="40" y="120" font-size="13" font-weight="bold" fill="#334155">Patient: Al-Otaibi, Fahad</text>
    <text x="320" y="120" font-size="13" fill="#475569">MRN: 94021884 | Bed: 01</text>
    <text x="40" y="145" font-size="13" fill="#475569">Collection: 2026-09-15 09:15</text>
    <text x="320" y="145" font-size="13" fill="#475569">Physician: Dr. Hesham Talaat</text>

    <!-- Table Header -->
    <rect x="25" y="180" width="550" height="32" fill="#f1f5f9"/>
    <text x="40" y="201" font-size="13" font-weight="bold" fill="#1e293b">INVESTIGATION</text>
    <text x="240" y="201" font-size="13" font-weight="bold" fill="#1e293b">RESULT</text>
    <text x="360" y="201" font-size="13" font-weight="bold" fill="#1e293b">FLAG</text>
    <text x="440" y="201" font-size="13" font-weight="bold" fill="#1e293b">REFERENCE</text>

    <!-- WBC -->
    <text x="40" y="240" font-size="14" font-weight="bold" fill="#0f172a">WBC (Leukocytes)</text>
    <text x="240" y="240" font-size="14" font-weight="bold" fill="#dc2626">17.8 x10^3/uL</text>
    <text x="360" y="240" font-size="14" font-weight="bold" fill="#dc2626">HIGH</text>
    <text x="440" y="240" font-size="13" fill="#64748b">4.0 - 11.0</text>

    <!-- Hemoglobin -->
    <text x="40" y="280" font-size="14" font-weight="bold" fill="#0f172a">Hemoglobin (Hb)</text>
    <text x="240" y="280" font-size="14" font-weight="bold" fill="#dc2626">8.4 g/dL</text>
    <text x="360" y="280" font-size="14" font-weight="bold" fill="#dc2626">LOW</text>
    <text x="440" y="280" font-size="13" fill="#64748b">13.0 - 17.5</text>

    <!-- Hematocrit -->
    <text x="40" y="320" font-size="14" fill="#0f172a">Hematocrit (Hct)</text>
    <text x="240" y="320" font-size="14" fill="#dc2626">26.2 %</text>
    <text x="360" y="320" font-size="14" font-weight="bold" fill="#dc2626">LOW</text>
    <text x="440" y="320" font-size="13" fill="#64748b">40.0 - 52.0</text>

    <!-- Platelets -->
    <text x="40" y="360" font-size="14" font-weight="bold" fill="#0f172a">Platelet Count (PLT)</text>
    <text x="240" y="360" font-size="14" font-weight="bold" fill="#dc2626">78 x10^3/uL</text>
    <text x="360" y="360" font-size="14" font-weight="bold" fill="#dc2626">LOW</text>
    <text x="440" y="360" font-size="13" fill="#64748b">150 - 450</text>

    <!-- RBC indices -->
    <text x="40" y="400" font-size="14" fill="#0f172a">RBC Count</text>
    <text x="240" y="400" font-size="14" fill="#475569">2.95 x10^6/uL</text>
    <text x="360" y="400" font-size="14" fill="#dc2626">LOW</text>
    <text x="440" y="400" font-size="13" fill="#64748b">4.5 - 5.9</text>

    <text x="40" y="435" font-size="14" fill="#0f172a">MCV</text>
    <text x="240" y="435" font-size="14" fill="#475569">88.8 fL</text>
    <text x="360" y="435" font-size="14" fill="#16a34a">NORMAL</text>
    <text x="440" y="435" font-size="13" fill="#64748b">80 - 100</text>

    <!-- Differential -->
    <line x1="25" y1="465" x2="575" y2="465" stroke="#e2e8f0"/>
    <text x="40" y="490" font-size="13" font-weight="bold" fill="#0f172a">DIFFERENTIAL LEUKOCYTE COUNT:</text>
    <text x="40" y="520" font-size="13" fill="#334155">Neutrophils: 84 % (Elevated / Left Shift)</text>
    <text x="320" y="520" font-size="13" fill="#334155">Lymphocytes: 9 % (Low)</text>
    <text x="40" y="550" font-size="13" fill="#334155">Monocytes: 5 %</text>
    <text x="320" y="550" font-size="13" fill="#334155">Eosinophils: 1 %</text>

    <!-- Pathologist Note -->
    <rect x="25" y="590" width="550" height="95" rx="6" fill="#fffbeb" stroke="#fef3c7"/>
    <text x="40" y="618" font-size="13" font-weight="bold" fill="#92400e">Morphology &amp; Clinical Remarks:</text>
    <text x="40" y="642" font-size="13" fill="#b45309">Normocytic Normochromic Anemia with marked leukocytosis (toxic granulation noted).</text>
    <text x="40" y="665" font-size="13" fill="#b45309">Moderate thrombocytopenia present. Suggest checking DIC panel &amp; blood cultures.</text>

    <text x="300" y="740" text-anchor="middle" font-size="13" fill="#64748b">LABORATORY DIRECTOR: Prof. M. Hassan | VERIFIED</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

export function generateSampleChemistryImage(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="850" viewBox="0 0 600 850" style="background:#ffffff; font-family:Arial, sans-serif;">
    <rect width="600" height="850" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <rect x="0" y="0" width="600" height="80" fill="#065f46"/>
    <text x="300" y="45" text-anchor="middle" font-size="20" font-weight="bold" fill="#6ee7b7">CLINICAL BIOCHEMISTRY &amp; ELECTROLYTES</text>
    <text x="300" y="68" text-anchor="middle" font-size="13" fill="#a7f3d0">MICU COMPREHENSIVE METABOLIC PANEL</text>

    <rect x="25" y="95" width="550" height="65" rx="6" fill="#f0fdf4" stroke="#bbf7d0"/>
    <text x="40" y="120" font-size="13" font-weight="bold" fill="#064e3b">Patient: Al-Otaibi, Fahad</text>
    <text x="320" y="120" font-size="13" fill="#047857">MRN: 94021884 | Bed: 01</text>
    <text x="40" y="145" font-size="13" fill="#047857">Collection: 2026-09-15 10:00</text>
    <text x="320" y="145" font-size="13" fill="#047857">Status: STAT VERIFIED</text>

    <!-- Table Header -->
    <rect x="25" y="180" width="550" height="32" fill="#ecfdf5"/>
    <text x="40" y="201" font-size="13" font-weight="bold" fill="#065f46">TEST NAME</text>
    <text x="240" y="201" font-size="13" font-weight="bold" fill="#065f46">RESULT</text>
    <text x="360" y="201" font-size="13" font-weight="bold" fill="#065f46">FLAG</text>
    <text x="440" y="201" font-size="13" font-weight="bold" fill="#065f46">REFERENCE</text>

    <!-- Serum Sodium -->
    <text x="40" y="240" font-size="14" font-weight="bold" fill="#0f172a">Sodium (Na+)</text>
    <text x="240" y="240" font-size="14" font-weight="bold" fill="#0f172a">138 mEq/L</text>
    <text x="360" y="240" font-size="14" fill="#16a34a">NORMAL</text>
    <text x="440" y="240" font-size="13" fill="#64748b">135 - 145</text>

    <!-- Serum Potassium -->
    <text x="40" y="280" font-size="14" font-weight="bold" fill="#0f172a">Potassium (K+)</text>
    <text x="240" y="280" font-size="14" font-weight="bold" fill="#dc2626">5.6 mEq/L</text>
    <text x="360" y="280" font-size="14" font-weight="bold" fill="#dc2626">HIGH</text>
    <text x="440" y="280" font-size="13" fill="#64748b">3.5 - 5.0</text>

    <!-- Serum Creatinine -->
    <text x="40" y="320" font-size="14" font-weight="bold" fill="#0f172a">Creatinine</text>
    <text x="240" y="320" font-size="14" font-weight="bold" fill="#dc2626">2.4 mg/dL</text>
    <text x="360" y="320" font-size="14" font-weight="bold" fill="#dc2626">HIGH</text>
    <text x="440" y="320" font-size="13" fill="#64748b">0.7 - 1.2</text>

    <!-- Blood Urea Nitrogen -->
    <text x="40" y="360" font-size="14" font-weight="bold" fill="#0f172a">Urea (BUN)</text>
    <text x="240" y="360" font-size="14" font-weight="bold" fill="#dc2626">48 mg/dL</text>
    <text x="360" y="360" font-size="14" font-weight="bold" fill="#dc2626">HIGH</text>
    <text x="440" y="360" font-size="13" fill="#64748b">15 - 45</text>

    <!-- ALT / AST -->
    <text x="40" y="400" font-size="14" fill="#0f172a">ALT (SGPT)</text>
    <text x="240" y="400" font-size="14" fill="#0f172a">68 U/L</text>
    <text x="360" y="400" font-size="14" font-weight="bold" fill="#dc2626">HIGH</text>
    <text x="440" y="400" font-size="13" fill="#64748b">7 - 56</text>

    <text x="40" y="435" font-size="14" fill="#0f172a">AST (SGOT)</text>
    <text x="240" y="435" font-size="14" fill="#0f172a">72 U/L</text>
    <text x="360" y="435" font-size="14" font-weight="bold" fill="#dc2626">HIGH</text>
    <text x="440" y="435" font-size="13" fill="#64748b">8 - 40</text>

    <!-- Total Bilirubin & Albumin -->
    <text x="40" y="470" font-size="14" fill="#0f172a">Total Bilirubin</text>
    <text x="240" y="470" font-size="14" fill="#0f172a">1.8 mg/dL</text>
    <text x="360" y="470" font-size="14" font-weight="bold" fill="#dc2626">HIGH</text>
    <text x="440" y="470" font-size="13" fill="#64748b">0.2 - 1.2</text>

    <text x="40" y="505" font-size="14" fill="#0f172a">Albumin</text>
    <text x="240" y="505" font-size="14" fill="#0f172a">3.1 g/dL</text>
    <text x="360" y="505" font-size="14" font-weight="bold" fill="#dc2626">LOW</text>
    <text x="440" y="505" font-size="13" fill="#64748b">3.5 - 5.0</text>

    <!-- CRP & Procalcitonin -->
    <text x="40" y="540" font-size="14" font-weight="bold" fill="#0f172a">C-Reactive Protein (CRP)</text>
    <text x="240" y="540" font-size="14" font-weight="bold" fill="#dc2626">42.0 mg/L</text>
    <text x="360" y="540" font-size="14" font-weight="bold" fill="#dc2626">HIGH</text>
    <text x="440" y="540" font-size="13" fill="#64748b">&lt; 5.0</text>

    <!-- Remarks -->
    <rect x="25" y="580" width="550" height="85" rx="6" fill="#f0fdf4" stroke="#bbf7d0"/>
    <text x="40" y="605" font-size="13" font-weight="bold" fill="#065f46">Biochemistry Remarks:</text>
    <text x="40" y="628" font-size="13" fill="#047857">Acute elevation in serum creatinine &amp; BUN consistent with AKI stage 2.</text>
    <text x="40" y="650" font-size="13" fill="#047857">Hyperkalemia (5.6 mEq/L) noted. Recommend repeat &amp; ECG monitoring.</text>

    <text x="300" y="740" text-anchor="middle" font-size="13" fill="#64748b">CONSULTANT BIOCHEMIST: Dr. S. Al-Dossari | VERIFIED</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}
