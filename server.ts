import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware for parsing large base64 image payloads
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Lazy initialize GenAI client
let genAiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is not set. Please configure it in Settings > Secrets.');
    }
    genAiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Lab OCR Scanner Endpoint
app.post('/api/ai/scan-lab', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', expectedType = 'ALL' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 data in request body.' });
    }

    // Strip data URL prefix if present
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');

    const ai = getGenAI();

    const promptText = `Analyze this medical laboratory test report or analyzer printout strip (such as Arterial Blood Gas ABG printout, Complete Blood Count CBC report, or Chemistry/Electrolyte panel).
Expected target type: ${expectedType}.

Extract all laboratory values carefully.
Return valid JSON matching the specified schema.

Specific mappings:
- For ABG:
  - ph: pH value (e.g. 7.35)
  - pco2: pCO2 in mmHg (e.g. 45.0)
  - po2: pO2 in mmHg (e.g. 88.0)
  - hco3: HCO3 in mmol/L or mEq/L (e.g. 24.5)
  - be: Base excess in mmol/L (e.g. -2.0)
  - lactate: Lactate in mmol/L or mg/dL (e.g. 1.8)
  - pf: PaO2/FiO2 ratio if available
  - so2: O2 saturation percentage

- For CBC:
  - wbc: White blood cell count in x10^3/uL or x10^9/L (e.g. 9.4)
  - hb: Hemoglobin in g/dL (e.g. 12.8)
  - hct: Hematocrit in % (e.g. 38.5)
  - plt: Platelets in x10^3/uL or x10^9/L (e.g. 210)
  - diff: Differential count notes (e.g. "Neut 75%, Lymph 18%")
  - typeAnemia: Morphologic anemia type if noted

- For Chemistry & Electrolytes:
  - urea, bun, creat, uricAcid
  - na, k, ca, phos, mg
  - totalBili, alb, alt, ast, alp, ggt

- For Coagulation & Cardiac / Biomarkers:
  - inr, pt, ptt, fib, troponin, ck, ckMb, crp, procalc, amylase, lipase, esr
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType || 'image/jpeg',
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        systemInstruction: `You are an expert ICU Clinical Laboratory Information System OCR engine.
Extract values with high medical precision from photos of laboratory printouts, thermal paper strips (like Radiometer/GEM ABG machines), or hematology analyzer reports.
Always respond in strictly valid JSON format.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedType: {
              type: Type.STRING,
              description: "Primary detected test type: 'ABG', 'CBC', 'CHEMISTRY_ELECTROLYTES', 'COAGULATION', 'CARDIAC', or 'COMPREHENSIVE'",
            },
            confidence: {
              type: Type.NUMBER,
              description: 'Confidence score from 0.0 to 1.0 based on image legibility and recognition certainty',
            },
            summaryEn: {
              type: Type.STRING,
              description: 'Concise clinical summary of findings in English',
            },
            summaryAr: {
              type: Type.STRING,
              description: 'Concise clinical summary of findings in Arabic',
            },
            sampleDate: {
              type: Type.STRING,
              description: 'Date and time of sample extraction if printed on report, else empty string',
            },
            patientName: {
              type: Type.STRING,
              description: 'Patient name if printed on report, else empty string',
            },
            mrn: {
              type: Type.STRING,
              description: 'MRN or sample ID if printed on report, else empty string',
            },
            statFields: {
              type: Type.OBJECT,
              description: 'Key-value map of normalized stat lab fields matching flowsheet slots',
              properties: {
                // CBC
                wbc: { type: Type.STRING },
                hb: { type: Type.STRING },
                hct: { type: Type.STRING },
                plt: { type: Type.STRING },
                diff: { type: Type.STRING },
                typeAnemia: { type: Type.STRING },
                // ABG
                ph: { type: Type.STRING },
                pco2: { type: Type.STRING },
                po2: { type: Type.STRING },
                hco3: { type: Type.STRING },
                be: { type: Type.STRING },
                lactate: { type: Type.STRING },
                pf: { type: Type.STRING },
                so2: { type: Type.STRING },
                // Renal & Electrolytes
                urea: { type: Type.STRING },
                creat: { type: Type.STRING },
                uricAcid: { type: Type.STRING },
                bun: { type: Type.STRING },
                na: { type: Type.STRING },
                k: { type: Type.STRING },
                ca: { type: Type.STRING },
                phos: { type: Type.STRING },
                mg: { type: Type.STRING },
                // Liver
                totalBili: { type: Type.STRING },
                alb: { type: Type.STRING },
                alt: { type: Type.STRING },
                ast: { type: Type.STRING },
                alp: { type: Type.STRING },
                ggt: { type: Type.STRING },
                // Coag & Cardiac
                inr: { type: Type.STRING },
                pt: { type: Type.STRING },
                ptt: { type: Type.STRING },
                fib: { type: Type.STRING },
                troponin: { type: Type.STRING },
                ck: { type: Type.STRING },
                ckMb: { type: Type.STRING },
                crp: { type: Type.STRING },
                procalc: { type: Type.STRING },
                amylase: { type: Type.STRING },
                lipase: { type: Type.STRING },
                esr: { type: Type.STRING },
              },
            },
            items: {
              type: Type.ARRAY,
              description: 'List of all detected individual test parameters with units and flags',
              items: {
                type: Type.OBJECT,
                properties: {
                  testName: { type: Type.STRING },
                  category: { type: Type.STRING },
                  value: { type: Type.STRING },
                  unit: { type: Type.STRING },
                  normalRange: { type: Type.STRING },
                  flag: { type: Type.STRING },
                },
                required: ['testName', 'value'],
              },
            },
          },
          required: ['detectedType', 'confidence', 'summaryEn', 'summaryAr', 'statFields', 'items'],
        },
      },
    });

    const rawText = response.text || '{}';
    const parsedData = JSON.parse(rawText);

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('[API /api/ai/scan-lab] Error:', error);
    const errMsg = error?.message || 'Failed to analyze lab image with Gemini AI';
    
    // Check if it's a 503 overload error from Gemini
    const isOverload = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand');
    const statusCode = isOverload ? 503 : 500;
    
    return res.status(statusCode).json({
      success: false,
      error: errMsg,
    });
  }
});

// Mount Vite middleware in development, or serve static build in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ICU-Sync Full-Stack Server running on port ${PORT}`);
  });
}

startServer();
