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

// Inicialização do Google GenAI usando a chave de ambiente do servidor com User-Agent exigido
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
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

// Endpoint de transcrição individual de áudio via Gemini 3.8 Flash e fallback
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType, fileName, userNotes, hasMultipleSpeakers } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Nenhum dado de áudio fornecido' });
    }

    const clientCustomKey = (req.headers['x-gemini-api-key'] as string) || req.body.customApiKey;
    const activeApiKey = clientCustomKey || process.env.GEMINI_API_KEY;

    if (!activeApiKey) {
      return res.status(500).json({ 
        error: 'Chave da API Gemini não configurada no servidor. Verifique a variável GEMINI_API_KEY.' 
      });
    }

    const cleanBase64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9-+.]+;base64,/, '');
    const resolvedMime = normalizeAudioMimeType(mimeType, fileName);
    const userNotesText = typeof userNotes === 'string' && userNotes.trim() ? userNotes.trim() : '';

    let promptText = `Você é o sistema de tecnologia acústica de ponta e transcrição profunda em língua portuguesa.
Sua missão: decodificar com sensibilidade acústica extrema e fidelidade absoluta tudo o que foi falado no áudio em tempo real.

DIRETRIZES CRÍTICAS E OBRIGATÓRIAS:
1. NÃO EXISTE ÁUDIO INAUDÍVEL: Use reconhecimento espectral e fonético profundo para reconstruir as palavras exatas mesmo com ruído severo, interferência de trânsito, vento, áudio abafado, distante, fala rápida, gírias, sotaques regionais ou sussurros. É TOTALMENTE PROIBIDO omitir palavras ou usar termos como "[inaudível]", "[áudio inaudível]" ou "[indecifrável]".
2. RECONHECIMENTO DE QUEM ESTÁ FALANDO (DIARIZAÇÃO DE 2 OU MAIS PESSOAS):
   Este áudio pode ser uma gravação de 2 ou mais pessoas (diálogo, conversa de WhatsApp gravada, reunião, entrevista, sobreposição de vozes ou intervenções rápidas).
   - Analise com precisão as variações de timbre, tom de voz, entonação e pausas de fala para identificar a troca de interlocutores.
   - Quando houver 2 ou mais vozes falando, separe e identifique cada interlocutor no início de sua respectiva fala:
     [Interlocutor 1]: Fala...
     [Interlocutor 2]: Resposta...
     [Interlocutor 1]: Réplica...
   - Se as observações do usuário mencionarem nomes específicos de pessoas (exemplo: "conversa entre João e Maria", "Dra. Ana e paciente Pedro"), atribua e utilize esses nomes reais nos rótulos: "[João]: ...", "[Maria]: ...".
   - Cada intervenção de orador deve estar em uma nova linha com seu rótulo correspondente.
   - Se for estritamente apenas 1 pessoa falando o tempo todo, transcreva de forma corrida e fluida sem inventar interlocutores fictícios.`;

    if (userNotesText) {
      promptText += `\n\n3. OBSERVAÇÃO DO ÁUDIO FORNECIDA PELO USUÁRIO:
"${userNotesText}"
Atenção prioritária: use estas informações de contexto fornecidas pelo usuário para identificar as pessoas que estão falando, seus respectivos nomes e o vocabulário correto.`;
    }

    promptText += `\n\n4. Retorne EXCLUSIVAMENTE o texto transcrito da fala com os rótulos de interlocutores, sem cumprimentos, explicações ou notas de rodapé fora do texto.`;

    // Ordem de modelos prioritária: gemini-3.5-transcribe com fallback para gemini-3.1-flash-lite
    const candidateModels = [
      'gemini-3.5-transcribe',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
    ];

    const currentAi = clientCustomKey
      ? new GoogleGenAI({
          apiKey: clientCustomKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        })
      : ai;

    let lastError: any = null;
    let transcriptionText = '';
    let usedModel = '';

    for (const modelName of candidateModels) {
      try {
        console.log(`[API Transcribe] Tentando modelo: ${modelName} para ${fileName || 'áudio'}...`);
        const response = await currentAi.models.generateContent({
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
            temperature: 0.0,
          },
        });

        let raw = (response.text || '').trim();
        // Remove qualquer menção residual a inaudível
        raw = raw
          .replace(/\[\s*(?:áudio\s+)?(?:inaudível|inaudivel|indecifrável|indecifravel|incompreensível|incompreensivel)\s*\]/gi, '')
          .replace(/\(\s*(?:áudio\s+)?(?:inaudível|inaudivel|indecifrável|indecifravel|incompreensível|incompreensivel)\s*\)/gi, '')
          .trim();

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
        // Prossegue para o próximo modelo da cadeia de fallback
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
    }

    if (lastError && !transcriptionText) {
      const errorStr = lastError.message || String(lastError);
      const isQuota = errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED') || errorStr.includes('Quota exceeded');
      
      return res.status(isQuota ? 429 : 500).json({
        error: isQuota
          ? 'Cota temporária atingida em todos os modelos da esteira (Gemini 3.5 Transcribe / 3.1 Flash-Lite). Tente novamente em instantes.'
          : (lastError.message || 'Falha ao processar áudio na esteira de transcrição'),
        isQuotaError: isQuota,
        details: errorStr,
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
      error: error.message || 'Falha ao transcrever o áudio com a API Gemini',
    });
  }
});

// Endpoint para leitura de fotos (OCR, documentos, cena) e análise/transcrição de vídeos do WhatsApp
app.post('/api/analyze-media', async (req, res) => {
  try {
    const { mediaBase64, mimeType, fileName, mediaType } = req.body;

    if (!mediaBase64) {
      return res.status(400).json({ error: 'Nenhum dado de mídia fornecido' });
    }

    const clientCustomKey = (req.headers['x-gemini-api-key'] as string) || req.body.customApiKey;
    const activeApiKey = clientCustomKey || process.env.GEMINI_API_KEY;

    if (!activeApiKey) {
      return res.status(500).json({
        error: 'Chave da API Gemini não configurada no servidor. Verifique a variável GEMINI_API_KEY.'
      });
    }

    const cleanBase64 = mediaBase64.replace(/^data:[a-zA-Z0-9-+/.]+;base64,/, '');
    const isVideo = mediaType === 'video' || (mimeType && mimeType.startsWith('video/'));

    const promptText = isVideo
      ? `Você é um perito em análise visual e transcrição multimodal de vídeos em língua portuguesa.
Sua missão: analisar a fundo este vídeo enviado no WhatsApp, descrever as ações e cenas e transcrever integralmente as falas presentes.

DIRETRIZES:
1. TRANSCRIÇÃO DE FALAS: Transcreva fielmente todos os diálogos ou falas contidas no vídeo em português, sem omitir nada e sem marcações de 'inaudível'.
2. LEITURA DE TEXTOS E ELEMENTOS VISUAIS: Se houver documentos, telas, placas ou textos visíveis no vídeo, leia e transcreva com exatidão.
3. DESCRIÇÃO DA CENA: Explique o que acontece no vídeo de forma clara, objetiva e contextualizada.

FORMATO:
- Transcrição do Áudio / Diálogos: [Faladas no vídeo]
- Descrição da Cena & Acontecimentos: [O que é mostrado no vídeo]
- Textos Visíveis (se houver): [Textos lidos no vídeo]`
      : `Você é um perito em leitura de documentos, OCR de alta precisão e análise de imagens em língua portuguesa.
Sua missão: ler e analisar minuciosamente esta foto/imagem enviada no WhatsApp.

DIRETRIZES:
1. LEITURA DE TEXTOS (OCR COMPLETO): Transcreva com 100% de exatidão qualquer texto visível na foto (comprovantes de pagamento, documentos, prints de conversa, recibos, bilhetes, placas ou anotações).
2. ANÁLISE VISUAL E CONTEXTO: Descreva com riqueza de detalhes o que a foto retrata (pessoas, local, objetos, itens fotografados e situação).
3. RESUMO CONTEXTUAL: Resuma o que essa imagem representa dentro da conversa.

FORMATO:
- Textos Lidos na Imagem (OCR): [Texto exato contido na foto]
- Descrição Visual & Contexto: [O que a foto mostra detalhadamente]`;

    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];

    const currentAi = clientCustomKey
      ? new GoogleGenAI({
          apiKey: clientCustomKey,
          httpOptions: {
            headers: { 'User-Agent': 'aistudio-build' },
          },
        })
      : ai;

    let lastError: any = null;
    let analysisResult = '';
    let usedModel = '';

    for (const modelName of candidateModels) {
      try {
        console.log(`[API Analyze Media] Tentando modelo: ${modelName} para ${fileName || 'mídia'}...`);
        const response = await currentAi.models.generateContent({
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
        error: lastError.message || 'Falha ao analisar a mídia com a IA',
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
      error: error.message || 'Falha ao processar arquivo visual com a IA',
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
