import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI, Type } from '@google/genai';

// Vercel Serverless Function configuration for large base64 image payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '30mb',
    },
  },
  maxDuration: 60, // allow up to 60 seconds for Gemini vision processing
};

interface VercelReq extends IncomingMessage {
  body?: any;
  query?: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
  method?: string;
}

interface VercelRes extends ServerResponse {
  status(code: number): VercelRes;
  json(body: any): void;
  send(body: any): void;
}

function sendJson(res: any, statusCode: number, data: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  return res.end(JSON.stringify(data));
}

// Helper to read request body if not parsed by Vercel automatically
async function parseBody(req: VercelReq): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }

  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      // 35MB limit
      if (raw.length > 35 * 1024 * 1024) {
        reject(new Error('Request payload too large (max 35MB)'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error('Invalid JSON in request body'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

export default async function handler(req: VercelReq, res: VercelRes) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  if (req.method === 'GET') {
    return sendJson(res, 200, {
      service: 'AI Lab Scanner API',
      status: 'active',
      supportedMethods: ['POST'],
      endpoint: '/api/scan-lab',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      success: false,
      error: `Method ${req.method} not allowed. Please send a POST request with imageBase64.`
    });
  }

  try {
    // 2. Parse payload
    const body = await parseBody(req);
    const { imageBase64, expectedType = 'ALL' } = body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return sendJson(res, 400, {
        success: false,
        error: 'Missing imageBase64 in request body. Please provide a valid Base64 encoded image string.'
      });
    }

    // 3. Extract and Clean Base64 Data URL
    // Removes "data:image/jpeg;base64," or any MIME prefix
    const mimeMatch = imageBase64.match(/^data:([a-zA-Z0-9/+-]+);base64,/);
    const detectedMimeType = mimeMatch ? mimeMatch[1] : (body.mimeType || 'image/jpeg');
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '').trim();

    if (!cleanBase64) {
      return sendJson(res, 400, {
        success: false,
        error: 'Empty image payload after removing data URL header.'
      });
    }

    // 4. Verify Gemini API Key
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return sendJson(res, 500, {
        success: false,
        error: 'مفتاح GEMINI_API_KEY غير موجود في إعدادات البيئة (Vercel Environment Variables). يرجى الدخول إلى لوحة تحكم مشروع Vercel > Settings > Environment Variables وإضافة GEMINI_API_KEY ثم إعادة النشر (Redeploy).'
      });
    }

    // 5. Initialize GenAI Client
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'soli-medical-micu-lab-scanner'
        }
      }
    });

    // 6. Define prompt and JSON Schema
    const promptText = `Analyze this medical laboratory test report or analyzer printout strip (such as Arterial Blood Gas ABG printout, Complete Blood Count CBC report, or Chemistry/Electrolyte panel).
Target type expected: ${expectedType}.

Extract all laboratory values carefully.
Return strictly valid JSON matching the schema.

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

    const isSvg = detectedMimeType === 'image/svg+xml' || cleanBase64.startsWith('PHN2Zy') || cleanBase64.includes('PHN2Zy');
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
          mimeType: detectedMimeType || 'image/jpeg',
        },
      });
    }
    contentParts.push({
      text: promptText,
    });

    // 7. Models to try with multi-model fallback cascade
    // Supports gemini-2.5-flash, gemini-1.5-flash, gemini-3.8-flash, gemini-3.1-flash-lite
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.6-flash'
    ];

    let response: any = null;
    let lastError: any = null;

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
            await new Promise(r => setTimeout(r, 800));
            continue;
          }
          console.warn(`[Vercel /api/scan-lab] Model ${modelName} failed:`, err?.message || err);
          break;
        }
      }
      if (response && response.text) {
        break;
      }
    }

    if (!response || !response.text) {
      const detailedError = lastError?.message || 'Failed to process lab report with Gemini Vision models.';
      return sendJson(res, 502, {
        success: false,
        error: `فشل استخراج بيانات التحليل من النموذج الذكي: ${detailedError}`
      });
    }

    const rawText = response.text || '{}';
    const parsedData = JSON.parse(rawText);

    return sendJson(res, 200, {
      success: true,
      data: parsedData,
    });

  } catch (error: any) {
    console.error('[Vercel /api/scan-lab] Unexpected Error:', error);
    return sendJson(res, 500, {
      success: false,
      error: error?.message || 'Internal error occurred while processing lab image.'
    });
  }
}
