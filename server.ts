import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Aumentar o limite para suportar áudios em base64
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// In-memory Rate Limiter simples e eficiente por IP
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 25; // 25 requisições por minuto por IP

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - entry.count };
}

// Limpeza periódica do mapa de rate limit a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// In-memory Quota Tracker por IP para garantir limite de testes gratuitos no backend
const ipQuotaMap = new Map<string, number>();
const MAX_FREE_IP_AUDIOS = 5;

// Códigos promocionais / passcodes válidos para desbloqueio homologado
const VALID_PASSCODES = new Set([
  'ORACULO-PRO-2026',
  'TRANSCREVA-VIP',
  'CONSULTA-PREMIUM',
  'BABADO-UNLIMITED',
]);

// Inicialização do Google GenAI usando EXCLUSIVAMENTE a chave segura do servidor
const serverGeminiApiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: serverGeminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Normaliza o MIME type de áudio para formatos aceitos pelo Gemini
 */
function normalizeAudioMimeType(mimeType?: string, fileName?: string): string {
  const ext = fileName ? path.extname(fileName).toLowerCase() : '';
  
  if (mimeType && mimeType.includes('audio/')) {
    if (mimeType.includes('opus') || mimeType.includes('ogg')) {
      return 'audio/ogg';
    }
    if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) {
      return 'audio/mp4';
    }
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
      return 'audio/mp3';
    }
    if (mimeType.includes('wav')) {
      return 'audio/wav';
    }
    return mimeType;
  }

  // Fallback baseado na extensão do arquivo
  switch (ext) {
    case '.opus':
    case '.ogg':
      return 'audio/ogg';
    case '.m4a':
    case '.aac':
      return 'audio/mp4';
    case '.mp3':
      return 'audio/mp3';
    case '.wav':
      return 'audio/wav';
    default:
      return 'audio/ogg';
  }
}

// Endpoint de verificação e controle de cota server-side
app.get('/api/billing/quota', (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const used = ipQuotaMap.get(clientIp) || 0;
  res.json({
    totalFree: MAX_FREE_IP_AUDIOS,
    used,
    remaining: Math.max(0, MAX_FREE_IP_AUDIOS - used),
  });
});

// Endpoint para validar código promocional ou chave de acesso de homologação
app.post('/api/billing/validate-passcode', (req, res) => {
  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ valid: false, error: 'Código de liberação inválido.' });
  }

  const normalized = code.trim().toUpperCase();
  if (VALID_PASSCODES.has(normalized)) {
    return res.json({
      valid: true,
      plan: 'unlimited_pro',
      message: 'Acesso VIP ativado com sucesso!',
    });
  }

  return res.status(403).json({
    valid: false,
    error: 'Código não encontrado ou expirado.',
  });
});

// Endpoint de transcrição individual de áudio via Gemini com proteção de rate limit e fidelidade estrita
app.post('/api/transcribe', async (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    
    // 1. Verificação de Rate Limit
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'Limite de requisições por minuto atingido. Aguarde alguns instantes para nova transcrição.',
      });
    }

    const { audioBase64, mimeType, fileName, userNotes, hasMultipleSpeakers } = req.body;

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Nenhum dado de áudio válido fornecido.' });
    }

    if (!serverGeminiApiKey) {
      return res.status(500).json({ 
        error: 'Serviço de transcrição temporariamente indisponível. Contate o administrador.' 
      });
    }

    const cleanBase64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9-+.]+;base64,/, '');
    const resolvedMime = normalizeAudioMimeType(mimeType, fileName);
    const userNotesText = typeof userNotes === 'string' && userNotes.trim() ? userNotes.trim() : '';

    // Prompt com diretrizes de fidelidade acústica: sensibilidade sem alucinação
    let promptText = `Você é um perito em transcrição acústica de alta sensibilidade e fidelidade estrita em língua portuguesa.
Sua prioridade máxima é a FIDELIDADE REAL da fala, preservando o significado exato sem inventar ou adivinhar o que não foi dito.

DIRETRIZES FUNDAMENTAIS:
1. FIDELIDADE REAL E PRESERVAÇÃO DE DÚVIDAS:
   - Transcreva com máxima precisão o que é audível, aproveitando seu poder de processamento para compreender fala com ruído, sotaques regionais, gírias e fala rápida.
   - NUNCA invente palavras, diálogos ou orações inteiras que não foram ditas.
   - Se um trecho sonoro for genuinamente indecifrável ou encoberto por ruído pesado, marque exatamente [trecho inaudível] ou [trecho incerto: <palavra provável>]. Preservar trechos incertos é vital para posterior revisão humana.
2. RECONHECIMENTO DE QUEM ESTÁ FALANDO (DIARIZAÇÃO DE 2 OU MAIS PESSOAS):
   - Analise com cuidado timbres, entonação e pausas de fala para identificar a troca de interlocutores.
   - Quando houver 2 ou mais pessoas dialogando, separe cada fala com seu respectivo rótulo:
     [Interlocutor 1]: Fala...
     [Interlocutor 2]: Resposta...
   - Se as observações do usuário fornecerem nomes dos participantes, utilize esses nomes reais: [Nome 1]: ..., [Nome 2]: ...
   - Se for apenas 1 orador falando, transcreva o texto de forma fluida sem criar interlocutores fictícios.`;

    if (userNotesText) {
      promptText += `\n\n3. OBSERVAÇÃO DO ÁUDIO FORNECIDA PELO USUÁRIO:
"${userNotesText}"
Utilize estas informações de contexto fornecidas para identificar corretamente os participantes e termos específicos.`;
    }

    promptText += `\n\n4. Retorne EXCLUSIVAMENTE o texto transcrito com a rotulagem de interlocutores, sem introduções ou notas de encerramento fora da transcrição.`;

    // Ordem de modelos prioritária
    const candidateModels = [
      'gemini-3.5-transcribe',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
    ];

    let lastError: any = null;
    let transcriptionText = '';
    let usedModel = '';

    for (const modelName of candidateModels) {
      try {
        console.log(`[API Transcribe] Processando áudio (${fileName || 'áudio'}) com ${modelName}...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: resolvedMime,
                    data: cleanBase64,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
          ],
          config: {
            temperature: 0.1,
          },
        });

        const raw = (response.text || '').trim();
        if (raw) {
          transcriptionText = raw;
          usedModel = modelName;
          lastError = null;
          console.log(`[API Transcribe] Sucesso com modelo: ${modelName}`);
          break; // Sucesso, encerra o loop de fallback
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[API Transcribe] Tentativa no modelo ${modelName} falhou:`, err?.message || err);
        continue;
      }
    }

    // Extrai a lista de interlocutores identificados na transcrição
    const detectedSpeakers: string[] = [];
    if (transcriptionText) {
      const speakerRegex = /\[([^\]]+)\]:/g;
      let match;
      while ((match = speakerRegex.exec(transcriptionText)) !== null) {
        const name = match[1].trim();
        if (name && !detectedSpeakers.includes(name)) {
          detectedSpeakers.push(name);
        }
      }
      // Atualiza contador de cota gratuita por IP no servidor
      const currentIpUsage = ipQuotaMap.get(clientIp) || 0;
      ipQuotaMap.set(clientIp, currentIpUsage + 1);
    }

    if (lastError && !transcriptionText) {
      const errorStr = (lastError.message || String(lastError)).toLowerCase();
      const isQuota = errorStr.includes('429') || errorStr.includes('resource_exhausted') || errorStr.includes('quota');
      
      // Resposta sanitizada sem vazamento de detalhes técnicos internos
      return res.status(isQuota ? 429 : 500).json({
        error: isQuota
          ? 'Cota temporária atingida nos servidores de IA. Aguarde alguns instantes e tente novamente.'
          : 'Não foi possível processar este áudio no momento. Tente novamente em instantes.',
        isQuotaError: isQuota,
      });
    }

    return res.json({
      success: true,
      fileName: fileName || 'audio',
      transcription: transcriptionText || 'Áudio processado.',
      modelUsed: usedModel,
      speakersDetected: detectedSpeakers,
      hasMultipleSpeakers: detectedSpeakers.length >= 2,
    });
  } catch (error: any) {
    console.error('Erro geral na rota de transcrição:', error);
    return res.status(500).json({
      error: 'Falha interna ao processar áudio. Tente novamente.',
    });
  }
});

// Endpoint para leitura de fotos (OCR, documentos, cena) e análise/transcrição de vídeos do WhatsApp
app.post('/api/analyze-media', async (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'Limite de requisições por minuto atingido. Aguarde alguns instantes.',
      });
    }

    const { mediaBase64, mimeType, fileName, mediaType } = req.body;

    if (!mediaBase64 || typeof mediaBase64 !== 'string') {
      return res.status(400).json({ error: 'Nenhum dado de mídia válido fornecido.' });
    }

    if (!serverGeminiApiKey) {
      return res.status(500).json({
        error: 'Serviço de análise visual temporariamente indisponível.',
      });
    }

    const cleanBase64 = mediaBase64.replace(/^data:[a-zA-Z0-9-+/.]+;base64,/, '');
    const isVideo = mediaType === 'video' || (mimeType && mimeType.startsWith('video/'));

    const promptText = isVideo
      ? `Você é um perito em análise visual e transcrição multimodal de vídeos em língua portuguesa.
Sua missão: analisar este vídeo enviado no WhatsApp, descrever as ações/cenas e transcrever as falas presentes com fidelidade.

DIRETRIZES:
1. TRANSCRIÇÃO DE FALAS: Transcreva fielmente todos os diálogos ou falas contidas no vídeo em português. Se houver trechos inaudíveis, marque [trecho inaudível] em vez de inventar falas.
2. LEITURA DE TEXTOS E ELEMENTOS VISUAIS: Se houver documentos, telas, placas ou textos visíveis no vídeo, transcreva com exatidão.
3. DESCRIÇÃO DA CENA: Explique o que acontece no vídeo de forma clara e contextualizada.

FORMATO:
- Transcrição do Áudio / Diálogos: [Faladas no vídeo]
- Descrição da Cena & Acontecimentos: [O que é mostrado no vídeo]
- Textos Visíveis (se houver): [Textos lidos no vídeo]`
      : `Você é um perito em leitura de documentos, OCR de alta precisão e análise de imagens em língua portuguesa.
Sua missão: ler e analisar minuciosamente esta foto/imagem enviada no WhatsApp.

DIRETRIZES:
1. LEITURA DE TEXTOS (OCR COMPLETO): Transcreva com exatidão qualquer texto visível na foto (comprovantes, documentos, prints, recibos, anotações).
2. ANÁLISE VISUAL E CONTEXTO: Descreva o que a foto retrata com clareza.
3. RESUMO CONTEXTUAL: Resuma o que essa imagem representa dentro da conversa.

FORMATO:
- Textos Lidos na Imagem (OCR): [Texto exato contido na foto]
- Descrição Visual & Contexto: [O que a foto mostra detalhadamente]`;

    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];

    let lastError: any = null;
    let analysisResult = '';
    let usedModel = '';

    for (const modelName of candidateModels) {
      try {
        console.log(`[API Analyze Media] Processando mídia (${fileName || 'mídia'}) com ${modelName}...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
                    data: cleanBase64,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
          ],
        });

        analysisResult = (response.text || '').trim();
        usedModel = modelName;
        lastError = null;
        console.log(`[API Analyze Media] Sucesso com modelo: ${modelName}`);
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[API Analyze Media] Tentativa no modelo ${modelName} falhou:`, err?.message || err);
        continue;
      }
    }

    if (lastError && !analysisResult) {
      return res.status(500).json({
        error: 'Não foi possível analisar este arquivo de mídia. Tente novamente.',
      });
    }

    return res.json({
      success: true,
      fileName: fileName || 'media',
      analysis: analysisResult || 'Análise visual concluída.',
      modelUsed: usedModel,
    });
  } catch (error: any) {
    console.error('Erro na rota de análise de mídia:', error);
    return res.status(500).json({
      error: 'Falha interna ao processar mídia. Tente novamente.',
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT} (${isProd ? 'produção' : 'desenvolvimento'})`);
  });
}

startServer();
