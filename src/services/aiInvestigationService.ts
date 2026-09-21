export interface ScannedInvestigationResponse {
  modality: 'Chest X-Ray' | 'CT' | 'MRI' | 'Ultrasound' | 'ECG' | 'Echo' | 'Other';
  testName: string;
  status: 'ORDERED' | 'RESULTED' | 'REPORTED';
  timestamp: string;
  resultReport: string;
  notes?: string;
  summaryAr: string;
  summaryEn: string;
  confidence: number;
  hasCriticalFinding?: boolean;
  criticalFindingText?: string;
}

export async function scanInvestigationImage(
  imageBase64: string,
  mimeType = 'image/jpeg',
  expectedModality: string = 'ANY'
): Promise<ScannedInvestigationResponse> {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new Error('لم يتم تمرير بيانات الصورة (Image payload is empty)');
  }

  const mimeMatch = imageBase64.match(/^data:([a-zA-Z0-9/+-]+);base64,/);
  const resolvedMimeType = mimeMatch ? mimeMatch[1] : (mimeType || 'image/jpeg');

  const payload = JSON.stringify({
    imageBase64,
    mimeType: resolvedMimeType,
    expectedModality,
  });

  const headers = {
    'Content-Type': 'application/json',
  };

  const endpointsToTry = ['/api/scan-investigation', '/api/ai/scan-investigation'];
  let lastError: Error | null = null;

  for (const endpoint of endpointsToTry) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: payload,
      });

      if (response.status === 404 && endpoint !== endpointsToTry[endpointsToTry.length - 1]) {
        console.warn(`[AI Investigation Scanner] ${endpoint} returned 404, attempting fallback endpoint...`);
        continue;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const serverMsg = errData.error || errData.message;
        if (serverMsg) {
          throw new Error(serverMsg);
        }
        if (response.status === 404) {
          throw new Error(
            'مسار المعالجة غير موجود على الخادم (404: Route Not Found). تأكد من رفع مجلد /api ونشره على Vercel أو تفعيل الخادم.'
          );
        }
        throw new Error(`خطأ من الخادم (Status: ${response.status})`);
      }

      const result = await response.json().catch(() => ({}));
      if (!result.success || !result.data) {
        throw new Error(result.error || result.message || 'فشل استخراج وتحليل بيانات التقرير من الذكاء الاصطناعي.');
      }

      return result.data as ScannedInvestigationResponse;
    } catch (err: any) {
      lastError = err;
      if (!err.message?.includes('404')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('تعذر الاتصال بـ API فحص الأشعة والتقارير (Server responded with 404)');
}

// ---------------------------------------------------------------------------
// Realistic Diagnostic & Radiology Sample Generators (SVG Data URLs)
// ---------------------------------------------------------------------------

export function generateSampleCxrReport(): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <rect width="100%" height="100%" fill="#ffffff" />
  <rect x="25" y="25" width="750" height="950" fill="none" stroke="#2563eb" stroke-width="2" />
  
  <!-- Header -->
  <text x="50" y="70" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#1e3a8a">KING FAHD SPECIALIST HOSPITAL - DEPARTMENT OF RADIOLOGY</text>
  <text x="50" y="95" font-family="Arial, sans-serif" font-size="14" fill="#475569">MEDICAL INTENSIVE CARE UNIT (MICU) - PORTABLE RADIOGRAPHY REPORT</text>
  <line x1="50" y1="110" x2="750" y2="110" stroke="#cbd5e1" stroke-width="1.5" />

  <!-- Patient Details -->
  <text x="50" y="140" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">PATIENT: KHALED OMAR AL-GHAMDI</text>
  <text x="450" y="140" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">MRN: 9482014</text>
  <text x="50" y="165" font-family="Arial, sans-serif" font-size="12" fill="#334155">LOCATION: BED 02 - MICU</text>
  <text x="450" y="165" font-family="Arial, sans-serif" font-size="12" fill="#334155">EXAM DATE: ${new Date().toLocaleDateString('en-GB')} 07:45</text>
  <line x1="50" y1="185" x2="750" y2="185" stroke="#cbd5e1" stroke-width="1.5" />

  <!-- Exam Name -->
  <text x="50" y="220" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#0369a1">EXAMINATION: CHEST 1 VIEW (PORTABLE AP UPRIGHT)</text>
  <text x="50" y="245" font-family="Arial, sans-serif" font-size="12" fill="#475569">CLINICAL INDICATION: Intubated patient with acute hypoxic respiratory failure, evaluate ETT and CVC position.</text>
  <text x="50" y="270" font-family="Arial, sans-serif" font-size="12" fill="#475569">COMPARISON: Chest radiograph from yesterday 18:00.</text>

  <!-- Findings -->
  <text x="50" y="320" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#0f172a">FINDINGS &amp; SUPPORT APPARATUS:</text>
  <text x="50" y="350" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">1. Endotracheal tube: Distal tip is 3.5 cm above the main carina in satisfactory tracheal alignment.</text>
  <text x="50" y="380" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">2. Vascular lines: Right internal jugular triple-lumen CVC tip terminates at the cavoatrial junction.</text>
  <text x="50" y="410" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">3. Enteric tube: Nasogastric tube courses below diaphragm with side hole in gastric body.</text>
  <text x="50" y="440" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">4. Lungs &amp; Pleura: Bilateral diffuse patchy mid and lower lung alveolar infiltrates, consistent with ARDS.</text>
  <text x="50" y="470" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">5. Pleural spaces: Small bilateral blunting of costophrenic angles. NO pneumothorax detected.</text>
  <text x="50" y="500" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">6. Heart &amp; Mediastinum: Cardiothoracic ratio upper normal range. Mediastinal contours stable.</text>

  <!-- Impression -->
  <rect x="50" y="550" width="700" height="150" fill="#f8fafc" stroke="#3b82f6" stroke-width="1.5" rx="8" />
  <text x="70" y="580" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#1d4ed8">IMPRESSION:</text>
  <text x="70" y="610" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">• Appropriate placement of ETT, right IJV CVC, and NGT.</text>
  <text x="70" y="640" font-family="Arial, sans-serif" font-size="12" fill="#0f172a">• Bilateral pulmonary airspace opacities consistent with ARDS / aspiration, slightly improved.</text>
  <text x="70" y="670" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#15803d">• No evidence of pneumothorax or acute barotrauma.</text>

  <!-- Signoff -->
  <text x="50" y="760" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#334155">REPORTED BY: Dr. Tariq Al-Mansoor, MD (Consultant Radiologist)</text>
  <text x="50" y="785" font-family="Arial, sans-serif" font-size="11" fill="#64748b">Verified &amp; Electronically Signed: ${new Date().toLocaleDateString('en-GB')} 08:15 AST</text>
</svg>
`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function generateSampleCtBrainReport(): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <rect width="100%" height="100%" fill="#ffffff" />
  <rect x="25" y="25" width="750" height="950" fill="none" stroke="#0d9488" stroke-width="2" />
  
  <text x="50" y="70" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#115e59">REGIONAL NEUROSCIENCES &amp; ICU IMAGING CENTER</text>
  <text x="50" y="95" font-family="Arial, sans-serif" font-size="14" fill="#475569">COMPUTED TOMOGRAPHY (CT) OF THE HEAD WITHOUT IV CONTRAST</text>
  <line x1="50" y1="110" x2="750" y2="110" stroke="#cbd5e1" stroke-width="1.5" />

  <text x="50" y="140" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">PATIENT: FATIMA AL-DOSARI</text>
  <text x="450" y="140" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">MRN: 8821940</text>
  <text x="50" y="165" font-family="Arial, sans-serif" font-size="12" fill="#334155">DEPARTMENT: MICU BED 01</text>
  <text x="450" y="165" font-family="Arial, sans-serif" font-size="12" fill="#334155">STUDY DATE: ${new Date().toLocaleDateString('en-GB')} 11:20</text>
  <line x1="50" y1="185" x2="750" y2="185" stroke="#cbd5e1" stroke-width="1.5" />

  <text x="50" y="220" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#0f766e">INDICATION: Acute drop in Glasgow Coma Scale (GCS 8), evaluate for acute hemorrhage or infarct.</text>

  <text x="50" y="270" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#0f172a">FINDINGS:</text>
  <text x="50" y="305" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">1. Brain Parenchyma: No evidence of acute intra-axial or extra-axial hemorrhage (subdural/epidural/SAH).</text>
  <text x="50" y="335" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">2. Mass Effect: Ventricles and basal cisterns are patent. No midline shift or brainstem herniation.</text>
  <text x="50" y="365" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">3. Ischemia: Subcortical chronic microvascular ischemic changes noted. No clear early MCA sign.</text>
  <text x="50" y="395" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">4. Calvarium: Visualized paranasal sinuses and mastoid air cells are clear. Intact calvarium without fracture.</text>

  <rect x="50" y="450" width="700" height="130" fill="#f0fdfa" stroke="#0d9488" stroke-width="1.5" rx="8" />
  <text x="70" y="480" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#0f766e">IMPRESSION:</text>
  <text x="70" y="510" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">1. NO ACUTE INTRACRANIAL HEMORRHAGE OR LARGE MASS EFFECT.</text>
  <text x="70" y="540" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">2. Mild age-related cerebral involution and chronic small vessel white matter disease.</text>

  <text x="50" y="630" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#334155">INTERPRETED BY: Dr. Laila Al-Shehri (Consultant Neuroradiologist)</text>
  <text x="50" y="655" font-family="Arial, sans-serif" font-size="11" fill="#64748b">Verified: ${new Date().toLocaleDateString('en-GB')} 12:05 AST</text>
</svg>
`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function generateSampleEcgReport(): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 650" width="800" height="650">
  <rect width="100%" height="100%" fill="#fff5f5" />
  <rect x="15" y="15" width="770" height="620" fill="none" stroke="#f43f5e" stroke-width="2" />
  
  <text x="35" y="50" font-family="monospace" font-size="16" font-weight="bold" fill="#9f1239">MINDRAY D60 12-LEAD DIAGNOSTIC ECG REPORT</text>
  <text x="500" y="50" font-family="monospace" font-size="12" fill="#475569">SPEED: 25mm/s  VOLTAGE: 10mm/mV</text>
  <line x1="35" y1="65" x2="765" y2="65" stroke="#fecdd3" stroke-width="1.5" />

  <text x="35" y="95" font-family="monospace" font-size="13" font-weight="bold" fill="#0f172a">PATIENT: OMAR ABDULLAH | AGE: 61 Y | SEX: MALE | BED: 03</text>
  <text x="35" y="120" font-family="monospace" font-size="12" fill="#334155">DATE: ${new Date().toLocaleDateString('en-GB')} 06:30 | HR: 106 BPM | PR: 162 ms | QRS: 88 ms | QT/QTc: 364/486 ms</text>
  
  <rect x="35" y="140" width="730" height="240" fill="#ffffff" stroke="#fda4af" stroke-width="1" />
  <!-- ECG Rhythm grid lines and simulated trace -->
  <path d="M 40 260 L 100 260 L 110 240 L 120 280 L 130 180 L 140 290 L 150 260 L 190 260 L 210 235 L 240 260 L 300 260 L 310 240 L 320 280 L 330 180 L 340 290 L 350 260 L 390 260 L 410 235 L 440 260 L 500 260 L 510 240 L 520 280 L 530 180 L 540 290 L 550 260 L 590 260 L 610 235 L 640 260 L 700 260 L 710 240 L 720 280 L 730 180 L 740 290 L 750 260" fill="none" stroke="#e11d48" stroke-width="2" />
  <text x="50" y="170" font-family="monospace" font-size="12" font-weight="bold" fill="#e11d48">LEAD II (MONITOR)</text>

  <rect x="35" y="400" width="730" height="150" fill="#fff1f2" stroke="#e11d48" stroke-width="1.5" rx="6" />
  <text x="55" y="430" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#9f1239">AUTOMATED DIAGNOSTIC INTERPRETATION:</text>
  <text x="55" y="460" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#1e293b">• SINUS TACHYCARDIA (HR 106 BPM)</text>
  <text x="55" y="485" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">• NORMAL FRONTAL PLANE QRS AXIS</text>
  <text x="55" y="510" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">• NON-SPECIFIC T WAVE FLATTENING IN ANTEROLATERAL LEADS (V4-V6)</text>
  <text x="55" y="535" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#be123c">• PROLONGED QTc (486 ms) - CLINICAL CORRELATION ADVISED WITH ELECTROLYTES &amp; DRUGS</text>

  <text x="35" y="585" font-family="Arial, sans-serif" font-size="11" fill="#64748b">Confirmed by ICU Fellow: Dr. Hesham Talaat | Status: Clinically Reviewed</text>
</svg>
`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function generateSampleEchoReport(): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 850" width="800" height="850">
  <rect width="100%" height="100%" fill="#ffffff" />
  <rect x="25" y="25" width="750" height="800" fill="none" stroke="#8b5cf6" stroke-width="2" />
  
  <text x="50" y="70" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#5b21b6">MICU BEDSIDE POCUS &amp; ECHOCARDIOGRAPHY REPORT</text>
  <text x="50" y="95" font-family="Arial, sans-serif" font-size="14" fill="#475569">POINT-OF-CARE FOCUSED ULTRASOUND (BLUE &amp; FATE PROTOCOL)</text>
  <line x1="50" y1="110" x2="750" y2="110" stroke="#cbd5e1" stroke-width="1.5" />

  <text x="50" y="140" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">PATIENT: AHMED MANSOUR</text>
  <text x="450" y="140" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">MRN: 7739102</text>
  <text x="50" y="165" font-family="Arial, sans-serif" font-size="12" fill="#334155">BED: 04</text>
  <text x="450" y="165" font-family="Arial, sans-serif" font-size="12" fill="#334155">STUDY TIME: ${new Date().toLocaleDateString('en-GB')} 14:15</text>
  <line x1="50" y1="185" x2="750" y2="185" stroke="#cbd5e1" stroke-width="1.5" />

  <text x="50" y="220" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#6d28d9">CARDIAC FINDINGS (FATE):</text>
  <text x="50" y="250" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">• Left Ventricle: Hyperdynamic systolic function. Visual EF estimated at 55-60%.</text>
  <text x="50" y="280" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">• Right Ventricle: Normal size and systolic function. TAPSE: 22 mm. No McConnell sign.</text>
  <text x="50" y="310" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">• Pericardium: No pericardial effusion or tamponade features.</text>
  <text x="50" y="340" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">• Inferior Vena Cava (IVC): Diameter 1.2 cm, collapsible > 50% with inspiration (Fluid responsive).</text>

  <text x="50" y="390" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#6d28d9">LUNG ULTRASOUND (BLUE PROTOCOL):</text>
  <text x="50" y="420" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">• Bilateral lung sliding present in all anterior zones (rules out pneumothorax).</text>
  <text x="50" y="450" font-family="Arial, sans-serif" font-size="12" fill="#1e293b">• Bilateral diffuse B-lines (B-profile) in bilateral lower and axillary zones.</text>

  <rect x="50" y="500" width="700" height="130" fill="#f5f3ff" stroke="#8b5cf6" stroke-width="1.5" rx="8" />
  <text x="70" y="530" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#6d28d9">SUMMARY &amp; CLINICAL IMPRESSION:</text>
  <text x="70" y="560" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">1. Normal global LV systolic function with signs of hypovolemia / fluid responsiveness (IVC collapsibility).</text>
  <text x="70" y="590" font-family="Arial, sans-serif" font-size="12" fill="#0f172a">2. Bilateral pulmonary B-lines indicative of non-cardiogenic pulmonary edema / ARDS.</text>

  <text x="50" y="680" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#334155">PERFORMED BY: Dr. Hesham Talaat, Consultant Critical Care</text>
</svg>
`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
