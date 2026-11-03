import JSZip from 'jszip';

export interface ExtractedAudioFile {
  name: string;
  cleanName: string;
  blob: Blob;
  objectUrl: string;
  size: number;
  mimeType: string;
  mediaType?: 'audio' | 'image' | 'video';
  durationSeconds?: number;
  transcription?: string;
  analysis?: string;
  modelUsed?: string;
  status: 'idle' | 'transcribing' | 'completed' | 'error';
  errorMessage?: string;
  fileDate?: Date;
  lastModified?: number;
  inferredTimestamp?: Date;
  inferredTimestampStr?: string;
  matchedSender?: string;
  matchedReason?: string;
  userNotes?: string;
  hasMultipleSpeakers?: boolean;
  speakersDetected?: string[];
}

export interface RawZipContent {
  zipName: string;
  chatFileName?: string;
  chatContent: string;
  audios: Map<string, ExtractedAudioFile>;
  allFileNames: string[];
}

/**
 * Detecta a duração de um arquivo de áudio ou vídeo em segundos via elemento Audio/Video
 */
export function detectAudioDuration(objectUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = objectUrl;
    audio.onloadedmetadata = () => {
      const dur = Math.round(audio.duration);
      resolve(isNaN(dur) ? 0 : dur);
    };
    audio.onerror = () => {
      resolve(0);
    };
  });
}

/**
 * Extensões suportadas de mídia (áudios, fotos e vídeos) do WhatsApp
 */
export const AUDIO_EXTENSIONS = ['.opus', '.ogg', '.m4a', '.mp3', '.wav', '.aac', '.amr', '.weba'];
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.bmp'];
export const VIDEO_EXTENSIONS = ['.mp4', '.3gp', '.mov', '.m4v', '.webm', '.avi', '.mkv'];

export function isAudioFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isImageFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isVideoFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isMediaFileName(fileName: string): boolean {
  return isAudioFileName(fileName) || isImageFileName(fileName) || isVideoFileName(fileName);
}

export function getMediaType(fileName: string): 'audio' | 'image' | 'video' {
  if (isImageFileName(fileName)) return 'image';
  if (isVideoFileName(fileName)) return 'video';
  return 'audio';
}

/**
 * Obtém o MIME type adequado para reprodução, exibição e análise por IA
 */
export function getMimeTypeForMedia(fileName: string): string {
  const lower = fileName.toLowerCase();
  // Imagens
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.heic')) return 'image/heic';
  // Vídeos
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'video/mp4';
  if (lower.endsWith('.3gp')) return 'video/3gpp';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  // Áudios
  if (lower.endsWith('.opus') || lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.mp3')) return 'audio/mp3';
  if (lower.endsWith('.m4a') || lower.endsWith('.aac')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.amr')) return 'audio/amr';
  return 'application/octet-stream';
}

export function getMimeTypeForAudio(fileName: string): string {
  return getMimeTypeForMedia(fileName);
}

/**
 * Descompacta o arquivo ZIP na memória do navegador
 */
export async function unpackZipFile(
  zipData: ArrayBuffer | Blob | File,
  zipName: string = 'arquivo.zip',
  onProgress?: (progressPercent: number) => void
): Promise<RawZipContent> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipData);

  const allFileNames: string[] = [];
  const audioMap = new Map<string, ExtractedAudioFile>();
  let primaryChatFileName: string | undefined;
  let primaryChatContent = '';

  const entries = Object.keys(loadedZip.files).filter((path) => !loadedZip.files[path].dir);
  const totalEntries = entries.length;
  let processedCount = 0;

  // Primeiro passo: identificar arquivo de texto do chat
  const candidateChatFile = entries.find((name) => {
    const base = name.split('/').pop()?.toLowerCase() || '';
    return base === '_chat.txt' || base.startsWith('conversa do whatsapp') || base.endsWith('.txt');
  });

  if (candidateChatFile) {
    primaryChatFileName = candidateChatFile.split('/').pop() || candidateChatFile;
    const file = loadedZip.file(candidateChatFile);
    if (file) {
      const arrayBuffer = await file.async('arraybuffer');
      const utf8Decoder = new TextDecoder('utf-8');
      let text = utf8Decoder.decode(arrayBuffer);
      text = text.replace(/^\uFEFF/, '').replace(/[\u200E\u200F\u202A-\u202E]/g, '');
      primaryChatContent = text;
    }
  }

  // Segundo passo: extrair todas as mídias (áudios, fotos e vídeos)
  for (const path of entries) {
    const fileName = path.split('/').pop() || path;
    allFileNames.push(fileName);

    if (isMediaFileName(fileName)) {
      const file = loadedZip.file(path);
      if (file) {
        const arrayBuffer = await file.async('arraybuffer');
        const mediaType = getMediaType(fileName);
        const mimeType = getMimeTypeForMedia(fileName);
        const blob = new Blob([arrayBuffer], { type: mimeType });
        const objectUrl = URL.createObjectURL(blob);

        const cleanName = fileName.trim().toLowerCase();
        const extracted: ExtractedAudioFile = {
          name: fileName,
          cleanName,
          blob,
          objectUrl,
          size: blob.size,
          mimeType,
          mediaType,
          status: 'idle',
          fileDate: file.date || undefined,
          lastModified: file.date ? file.date.getTime() : undefined,
        };

        // Carrega a duração se for áudio ou vídeo
        if (mediaType === 'audio' || mediaType === 'video') {
          detectAudioDuration(objectUrl).then((dur) => {
            extracted.durationSeconds = dur;
          });
        }

        audioMap.set(fileName, extracted);
        audioMap.set(cleanName, extracted);
      }
    }

    processedCount++;
    if (onProgress) {
      onProgress(Math.round((processedCount / totalEntries) * 100));
    }
  }

  return {
    zipName,
    chatFileName: primaryChatFileName,
    chatContent: primaryChatContent,
    audios: audioMap,
    allFileNames,
  };
}
