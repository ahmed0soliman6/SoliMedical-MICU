import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI, Type } from '@google/genai';

// Vercel Serverless Function configuration for large base64 image payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '30mb',
    },
  },
  maxDuration: 60,
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
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  if (req.method === 'GET') {
    return sendJson(res, 200, {
      service: 'AI Investigation & Radiology Scanner API',
      status: 'active',
      supportedMethods: ['POST'],
      endpoints: ['/api/scan-investigation', '/api/ai/scan-investigation'],
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      success: false,
      error: `Method ${req.method} not allowed. Please send a POST request with imageBase64.`,
    });
  }

  try {
    const body = await parseBody(req);
    const { imageBase64, expectedModality = 'ANY' } = body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return sendJson(res, 400, {
        success: false,
        error: 'Missing imageBase64 in request body. Please provide a valid Base64 encoded image string.',
      });
    }

    const mimeMatch = imageBase64.match(/^data:([a-zA-Z0-9/+-]+);base64,/);
    const detectedMimeType = mimeMatch ? mimeMatch[1] : (body.mimeType || 'image/jpeg');
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '').trim();

    if (!cleanBase64) {
      return sendJson(res, 400, {
        success: false,
        error: 'Empty image payload after removing data URL header.',
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return sendJson(res, 500, {
        success: false,
        error:
          'مفتاح GEMINI_API_KEY غير موجود في إعدادات البيئة على Vercel. يرجى الدخول إلى Project Settings > Environment Variables وإضافة GEMINI_API_KEY ثم إعادة النشر.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are an expert ICU Clinical Radiologist and Critical Care Specialist.
Your task is to analyze the provided medical image, which is either:
1. A radiology or diagnostic report printout (Chest X-Ray report, CT scan report, MRI report, Ultrasound/POCUS report, Echocardiogram report, 12-Lead ECG strip/report, or pathology/microbiology report).
2. A direct diagnostic radiographic image or monitor capture (CXR film, CT slices, bedside ultrasound/POCUS clip/photo, 12-lead ECG rhythm strip).

Expected modality hint from clinician: ${expectedModality}

Extract and structure the data precisely according to the JSON schema:
- modality: MUST be one of ["Chest X-Ray", "CT", "MRI", "Ultrasound", "ECG", "Echo", "Other"]
- testName: Specific clinical study name (e.g. "Portable CXR (AP View)", "CT Brain Non-Contrast", "Transthoracic Echocardiogram (TTE)", "12-Lead ECG", "Bedside Lung & Abdominal Ultrasound")
- status: "REPORTED" (if official report/radiologist impression exists) or "RESULTED"
- timestamp: Valid ISO-8601 string if a date/time is detected on the report or film (e.g. "2026-09-21T08:30:00Z"). If no date found, use current ISO time.
- resultReport: Complete, coherent, professional clinical findings and radiological impression. Format clearly with "FINDINGS:" and "IMPRESSION:". Highlight acute ICU findings (e.g. endotracheal tube distance above carina, CVC tip position, pneumothorax, pulmonary edema, consolidation/infiltrates, acute intracranial hemorrhage, midline shift, ischemia, ventricular ejection fraction, pericardial effusion).
- notes: Short practical notes (e.g., "Bedside portable study", "Compared with baseline", "Urgent alert communicated to ICU team").
- summaryAr: High-clarity medical Arabic summary (e.g., "أشعة صدر متنقلة: لا يوجد استرواح صدري، ارتشاح رئوي قاعدي ثنائي الجانب متوافق مع متلازمة الضائقة التنفسية، أنبوب التنفس أعلى الجؤجؤ بـ 3.5 سم").
- summaryEn: Concise English clinical summary.
- confidence: Confidence level between 0.50 and 1.00.
- hasCriticalFinding: true if there is an emergent finding requiring immediate intervention (pneumothorax, mass effect, acute stroke, ST elevation, massive effusion).
- criticalFindingText: Description of the critical finding if present, or empty string.

Ensure strict medical terminology and zero hallucination. If text is partially blurred, transcribe the legible clinical facts accurately.`;

    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
    ];

    let response: any = null;
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: detectedMimeType,
                },
              },
              {
                text: 'Analyze this diagnostic study or report. Extract modality, test name, findings, impression, timestamp, and clinical summaries.',
              },
            ],
          },
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                modality: {
                  type: Type.STRING,
                  description: 'Modality: Chest X-Ray, CT, MRI, Ultrasound, ECG, Echo, or Other',
                },
                testName: {
                  type: Type.STRING,
                  description: 'Specific clinical name of the test or imaging study',
                },
                status: {
                  type: Type.STRING,
                  description: 'REPORTED, RESULTED, or ORDERED',
                },
                timestamp: {
                  type: Type.STRING,
                  description: 'ISO-8601 timestamp string',
                },
                resultReport: {
                  type: Type.STRING,
                  description: 'Comprehensive findings, impression, and radiological details',
                },
                notes: {
                  type: Type.STRING,
                  description: 'Clinical notes or annotations',
                },
                summaryAr: {
                  type: Type.STRING,
                  description: 'Summary in Arabic with medical clarity',
                },
                summaryEn: {
                  type: Type.STRING,
                  description: 'Summary in English',
                },
                confidence: {
                  type: Type.NUMBER,
                  description: 'Confidence between 0 and 1',
                },
                hasCriticalFinding: {
                  type: Type.BOOLEAN,
                  description: 'Whether an acute emergency finding was detected',
                },
                criticalFindingText: {
                  type: Type.STRING,
                  description: 'Detail of acute emergency finding if any',
                },
              },
              required: ['modality', 'testName', 'status', 'resultReport', 'summaryEn', 'summaryAr'],
            },
          },
        });

        if (response && response.text) {
          break;
        }
      } catch (modelErr: any) {
        lastError = modelErr;
        console.warn(`[AI Investigation Scanner] Model ${modelName} failed, falling back:`, modelErr?.message || modelErr);
      }
    }

    if (!response || !response.text) {
      const errMsg = lastError?.message || 'Failed to analyze investigation with AI models.';
      return sendJson(res, 502, {
        success: false,
        error: errMsg,
      });
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(response.text);
    } catch {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from AI model');
      }
    }

    // Sanitize modality to match schema
    const validModalities = ['Chest X-Ray', 'CT', 'MRI', 'Ultrasound', 'ECG', 'Echo', 'Other'];
    if (!validModalities.includes(parsedData.modality)) {
      const mUpper = (parsedData.modality || '').toUpperCase();
      if (mUpper.includes('CHEST') || mUpper.includes('X-RAY') || mUpper.includes('CXR')) parsedData.modality = 'Chest X-Ray';
      else if (mUpper.includes('CT') || mUpper.includes('COMPUTED')) parsedData.modality = 'CT';
      else if (mUpper.includes('MRI') || mUpper.includes('MAGNETIC')) parsedData.modality = 'MRI';
      else if (mUpper.includes('ECHO')) parsedData.modality = 'Echo';
      else if (mUpper.includes('ULTRA') || mUpper.includes('US') || mUpper.includes('POCUS') || mUpper.includes('SONO')) parsedData.modality = 'Ultrasound';
      else if (mUpper.includes('ECG') || mUpper.includes('EKG')) parsedData.modality = 'ECG';
      else parsedData.modality = 'Other';
    }

    if (!parsedData.status || !['ORDERED', 'RESULTED', 'REPORTED'].includes(parsedData.status)) {
      parsedData.status = 'REPORTED';
    }

    if (!parsedData.timestamp || isNaN(new Date(parsedData.timestamp).getTime())) {
      parsedData.timestamp = new Date().toISOString();
    }

    return sendJson(res, 200, {
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('[AI Investigation Scanner API Error]:', error);
    return sendJson(res, 500, {
      success: false,
      error: error?.message || 'Internal server error processing investigation image',
    });
  }
}
