import { ExtractedAudioFile } from './zipParser';

/**
 * Converte um Blob de áudio para base64
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Retorna a string pura sem o prefixo data:audio/...;base64,
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface TranscribeResult {
  transcription: string;
  modelUsed?: string;
  speakersDetected?: string[];
  hasMultipleSpeakers?: boolean;
}

export interface SpeakerTurn {
  speaker: string;
  text: string;
}

/**
 * Decompõe a transcrição em turnos de diálogo quando há múltiplos oradores
 */
export function parseSpeakerTurns(text: string): SpeakerTurn[] {
  if (!text) return [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const turns: SpeakerTurn[] = [];

  const bracketPattern = /^\[([^\]]+)\]:\s*([\s\S]*)$/;
  const colonPattern = /^([A-Za-zÀ-ÖØ-öø-ÿ0-9\s._-]{2,25}):\s*([\s\S]*)$/;

  for (const line of lines) {
    const matchBracket = line.match(bracketPattern);
    if (matchBracket) {
      turns.push({
        speaker: matchBracket[1].trim(),
        text: matchBracket[2].trim(),
      });
      continue;
    }

    const matchColon = line.match(colonPattern);
    if (matchColon && !matchColon[1].toLowerCase().startsWith('http') && !matchColon[1].includes('/') && !matchColon[1].includes('http')) {
      turns.push({
        speaker: matchColon[1].trim(),
        text: matchColon[2].trim(),
      });
      continue;
    }

    if (turns.length > 0) {
      turns[turns.length - 1].text += ' ' + line;
    } else {
      turns.push({
        speaker: 'Voz Principal',
        text: line,
      });
    }
  }

  return turns;
}

/**
 * Envia um arquivo de áudio individual para o endpoint de transcrição no servidor
 */
export async function transcribeSingleAudio(
  audio: ExtractedAudioFile,
  signal?: AbortSignal
): Promise<TranscribeResult> {
  const base64 = await blobToBase64(audio.blob);

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audioBase64: base64,
      mimeType: audio.mimeType,
      fileName: audio.name,
      userNotes: audio.userNotes,
      hasMultipleSpeakers: audio.hasMultipleSpeakers,
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro HTTP ${response.status} na transcrição`);
  }

  const data = await response.json();
  const rawText = (data.transcription || '').trim();

  const detected: string[] = data.speakersDetected || [];
  if (detected.length === 0 && rawText) {
    const regex = /\[([^\]]+)\]:/g;
    let m;
    while ((m = regex.exec(rawText)) !== null) {
      const spk = m[1].trim();
      if (spk && !detected.includes(spk)) {
        detected.push(spk);
      }
    }
  }

  return {
    transcription: rawText || 'Áudio decodificado.',
    modelUsed: data.modelUsed,
    speakersDetected: detected,
    hasMultipleSpeakers: detected.length >= 2 || data.hasMultipleSpeakers || false,
  };
}

/**
 * Envia uma foto ou vídeo para o endpoint de leitura OCR e análise multimodal
 */
export async function analyzeSingleMedia(
  media: ExtractedAudioFile,
  signal?: AbortSignal
): Promise<{ analysis: string; transcription?: string; modelUsed?: string }> {
  const base64 = await blobToBase64(media.blob);

  const response = await fetch('/api/analyze-media', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mediaBase64: base64,
      mimeType: media.mimeType,
      fileName: media.name,
      mediaType: media.mediaType,
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro HTTP ${response.status} na análise da mídia`);
  }

  const data = await response.json();
  return {
    analysis: data.analysis || 'Conteúdo visual analisado com sucesso.',
    transcription: data.transcription,
    modelUsed: data.modelUsed,
  };
}

export interface QueueProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  currentFileName?: string;
  percent: number;
}

/**
 * Processador de fila concorrente com controle de progresso (áudios, fotos e vídeos)
 */
export async function processAudioQueue(
  audios: ExtractedAudioFile[],
  concurrency: number = 1,
  onProgress?: (progress: QueueProgress) => void,
  onAudioUpdated?: (audio: ExtractedAudioFile) => void,
  signal?: AbortSignal
): Promise<void> {
  const pending = [...audios.filter((a) => a.status !== 'completed')];
  const total = audios.length;
  let completed = audios.filter((a) => a.status === 'completed').length;
  let failed = 0;
  let inProgress = 0;

  const notify = (currentFileName?: string) => {
    if (onProgress) {
      onProgress({
        total,
        completed,
        failed,
        inProgress,
        currentFileName,
        percent: total > 0 ? Math.round(((completed + failed) / total) * 100) : 100,
      });
    }
  };

  notify();

  const worker = async () => {
    while (pending.length > 0) {
      if (signal?.aborted) break;

      const audio = pending.shift();
      if (!audio) break;

      inProgress++;
      audio.status = 'transcribing';
      audio.errorMessage = undefined;
      notify(audio.name);
      if (onAudioUpdated) onAudioUpdated(audio);

      try {
        if (audio.mediaType === 'image' || audio.mediaType === 'video') {
          const res = await analyzeSingleMedia(audio, signal);
          audio.analysis = res.analysis;
          if (res.transcription) {
            audio.transcription = res.transcription;
          }
          audio.modelUsed = res.modelUsed;
        } else {
          const result = await transcribeSingleAudio(audio, signal);
          audio.transcription = result.transcription;
          audio.modelUsed = result.modelUsed;
          if (result.speakersDetected) {
            audio.speakersDetected = result.speakersDetected;
            audio.hasMultipleSpeakers = result.hasMultipleSpeakers;
          }
        }

        audio.status = 'completed';
        completed++;
        // Pequena pausa amigável entre requisições para estabilidade de rate limit
        await new Promise((res) => setTimeout(res, 500));
      } catch (err: any) {
        if (signal?.aborted) {
          audio.status = 'idle';
          break;
        }
        console.error(`Falha ao transcrever ${audio.name}:`, err);
        const errMsg = err.message || 'Erro ao transcrever';
        audio.status = 'error';
        audio.errorMessage = errMsg;
        failed++;

        // Se for erro de cota 429 e restam itens, podemos pausar brevemente antes do próximo
        if (errMsg.includes('429') || errMsg.includes('cota') || errMsg.includes('Quota')) {
          console.warn('Erro de cota detectado. Aguardando 2 segundos antes de prosseguir...');
          await new Promise((res) => setTimeout(res, 2000));
        }
      } finally {
        inProgress--;
        notify();
        if (onAudioUpdated) onAudioUpdated(audio);
      }
    }
  };

  // Usamos concorrência de 1 para evitar bater no limite de requisições por segundo
  const pool = Array.from({ length: Math.min(1, pending.length) }, () => worker());
  await Promise.all(pool);
}
