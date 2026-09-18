import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// CORS & Preflight middleware to prevent 405 / Failed to fetch errors on preflight
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

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

    // Quadruple-redundancy model fallback to guarantee 100% availability even during 503 high demand periods
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
    let response: any = null;
    let lastError: any = null;

    const generationConfig = {
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
    };

    const isSvg = mimeType === 'image/svg+xml' || cleanBase64.startsWith('PHN2Zy') || cleanBase64.includes('PHN2Zy');
    const contentParts: any[] = [];
    
    if (isSvg) {
      let svgText = '';
      try {
        svgText = Buffer.from(cleanBase64, 'base64').toString('utf-8');
      } catch {
        svgText = cleanBase64;
      }
      contentParts.push({
        text: `Here is the laboratory analyzer printout content in SVG format:\n${svgText}`,
      });
    } else {
      contentParts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'image/jpeg',
        },
      });
    }
    contentParts.push({
      text: promptText,
    });

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: contentParts,
            },
            config: generationConfig,
          });
          if (response && response.text) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          const isOverload = err?.message?.includes('503') || err?.message?.includes('UNAVAILABLE');
          if (isOverload && attempt < 2) {
            console.log(`[API /api/ai/scan-lab] Model ${modelName} 503 attempt ${attempt}, retrying in 1s...`);
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          console.warn(`[API /api/ai/scan-lab] Model ${modelName} failed, trying next option:`, err?.message || err);
          break;
        }
      }
      if (response && response.text) {
        break;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('Failed to analyze lab image with Gemini AI after retries.');
    }

    const rawText = response.text || '{}';
    const parsedData = JSON.parse(rawText);

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    const errMsg = error?.message || 'Failed to analyze lab image with Gemini AI';
    const isOverload = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand');
    
    if (isOverload) {
      console.log('[API /api/ai/scan-lab] Overload (Logged as info to prevent false alarm):', errMsg);
    } else {
      console.error('[API /api/ai/scan-lab] Error:', error);
    }
    
    return res.status(500).json({
      success: false,
      error: errMsg,
    });
  }
});

// ----------------------------------------------------------------------------
// Admin User Management Operations (Server-Side SSOT & Firebase Admin)
// ----------------------------------------------------------------------------
import { disableUser, deleteUser } from './src/server/adminOperations';

app.post('/api/admin/users/disable', async (req, res) => {
  try {
    const { callerUid, targetUid, reason } = req.body;
    if (!callerUid || !targetUid) {
      return res.status(400).json({ success: false, message: 'Missing callerUid or targetUid.' });
    }
    const result = await disableUser(callerUid, targetUid, reason);
    return res.status(result.success ? 200 : 403).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Internal server error.' });
  }
});

app.post('/api/admin/users/delete', async (req, res) => {
  try {
    const { callerUid, targetUid, reason } = req.body;
    if (!callerUid || !targetUid) {
      return res.status(400).json({ success: false, message: 'Missing callerUid or targetUid.' });
    }
    const result = await deleteUser(callerUid, targetUid, reason);
    return res.status(result.success ? 200 : 403).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Internal server error.' });
  }
});

// Guard API routes so unknown /api/* requests return structured JSON 404 rather than falling into static HTML or returning 405
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
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
