import {
  ExtractedAudioFile,
  isAudioFileName,
  isImageFileName,
  isVideoFileName,
  getMediaType,
} from './zipParser';

export interface ChatMessage {
  id: string;
  rawLine: string;
  timestamp: string;
  timestampDate?: Date;
  sender: string;
  content: string;
  isAudio: boolean;
  isImage?: boolean;
  isVideo?: boolean;
  mediaType?: 'audio' | 'image' | 'video' | 'text';
  audioFileName?: string;
  mediaFileName?: string;
  audioFile?: ExtractedAudioFile;
  isSystem: boolean;
  matchedByTimestamp?: boolean;
}

export interface ParsedChat {
  messages: ChatMessage[];
  participants: string[];
  totalAudiosInChat: number;
  unlinkedAudios: ExtractedAudioFile[];
  matchedAudiosCount?: number;
  matchedByTimestampCount?: number;
}

/**
 * Regex para início de linha no formato iOS:
 * [14/08/2023, 19:42:15] Nome: Mensagem
 * [14/08/23, 19:42] Nome: Mensagem
 */
const IOS_LINE_REGEX = /^\[(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}[,\s]+[\d:]+(?:\s*[APap][Mm]|\s*[ap]\.?\s*m\.?)?)\]\s*([^:]+?):\s*([\s\S]*)$/;
const IOS_SYSTEM_REGEX = /^\[(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}[,\s]+[\d:]+(?:\s*[APap][Mm]|\s*[ap]\.?\s*m\.?)?)\]\s*([^:]+)$/;

/**
 * Regex para início de linha no formato Android:
 * 14/08/2023, 19:42 - Nome: Mensagem
 * 14/08/2023 19:42 - Nome: Mensagem
 */
const ANDROID_LINE_REGEX = /^(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}[,\s]+[\d:]+(?:\s*[APap][Mm]|\s*[ap]\.?\s*m\.?)?)\s*-\s*([^:]+?):\s*([\s\S]*)$/;
const ANDROID_SYSTEM_REGEX = /^(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}[,\s]+[\d:]+(?:\s*[APap][Mm]|\s*[ap]\.?\s*m\.?)?)\s*-\s*([^:]+)$/;

/**
 * Converte uma string de timestamp do WhatsApp em um objeto Date do JavaScript
 */
export function parseWhatsAppTimestamp(timestampStr: string): Date | null {
  if (!timestampStr) return null;
  const clean = timestampStr.trim().replace(/[\[\]]/g, '');

  // Padrão DD/MM/YYYY ou MM/DD/YYYY com HH:MM ou HH:MM:SS
  const match = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap][Mm]|\b[ap]\.?\s*m\.?\b)?/i);
  if (match) {
    const [, p1, p2, p3, hourStr, minStr, secStr, ampm] = match;
    let year = parseInt(p3, 10);
    if (year < 100) year += 2000;

    let day = parseInt(p1, 10);
    let month = parseInt(p2, 10);
    // Caso padrão americano (mês > 12 e dia <= 12)
    if (month > 12 && day <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }

    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minStr, 10);
    const second = secStr ? parseInt(secStr, 10) : 0;

    if (ampm) {
      const lower = ampm.toLowerCase();
      if ((lower.includes('p') || lower.includes('pm')) && hour < 12) {
        hour += 12;
      } else if ((lower.includes('a') || lower.includes('am')) && hour === 12) {
        hour = 0;
      }
    }

    const d = new Date(year, month - 1, day, hour, minute, second);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback para construtor padrão
  const direct = new Date(clean);
  if (!isNaN(direct.getTime())) return direct;

  return null;
}

/**
 * Formata um objeto Date de volta no padrão brasileiro legível do WhatsApp
 */
export function formatToWhatsAppTimestamp(d: Date, includeSeconds: boolean = true): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  if (includeSeconds) {
    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
  }
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

/**
 * Extrai data e hora precisas a partir do nome do arquivo ou metadados de modificação da mídia (áudios, fotos, vídeos)
 */
export function extractAudioTimestamp(audio: ExtractedAudioFile): Date | null {
  const fileName = audio.name;

  // 1. Padrão ISO / Android: (AUDIO|IMG|VID)-YYYY-MM-DD-HH-MM-SS ou YYYYMMDD_HHMMSS
  const matchIso = fileName.match(/(\d{4})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})(?:[-_](\d{2}))?/);
  if (matchIso) {
    const [, y, m, d, hh, mm, ss] = matchIso;
    const date = new Date(
      parseInt(y, 10),
      parseInt(m, 10) - 1,
      parseInt(d, 10),
      parseInt(hh, 10),
      parseInt(mm, 10),
      ss ? parseInt(ss, 10) : 0
    );
    if (!isNaN(date.getTime())) return date;
  }

  // 2. Padrão WhatsApp Audio/Image/Video YYYY-MM-DD at HH.MM.SS
  const matchWaAt = fileName.match(/WhatsApp\s+(?:Audio|Ptt|Image|Video|Foto|Gravação)\s+(\d{4})[-_](\d{2})[-_](\d{2})\s+at\s+(\d{2})[.\-_](\d{2})(?:[.\-_](\d{2}))?/i);
  if (matchWaAt) {
    const [, y, m, d, hh, mm, ss] = matchWaAt;
    const date = new Date(
      parseInt(y, 10),
      parseInt(m, 10) - 1,
      parseInt(d, 10),
      parseInt(hh, 10),
      parseInt(mm, 10),
      ss ? parseInt(ss, 10) : 0
    );
    if (!isNaN(date.getTime())) return date;
  }

  // 3. Padrão PTT-YYYYMMDD-WA..., AUD-YYYYMMDD-WA..., IMG-YYYYMMDD-WA... ou VID-YYYYMMDD-WA...
  const matchPtt = fileName.match(/(?:PTT|AUD|IMG|VID|PHOTO)-(\d{4})(\d{2})(\d{2})-WA(\d+)/i);
  if (matchPtt) {
    const [, y, m, d, waNum] = matchPtt;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10) - 1;
    const day = parseInt(d, 10);

    // Se temos hora precisa nos metadados do ZIP ou arquivo (fileDate / lastModified)
    if (audio.fileDate && !isNaN(audio.fileDate.getTime())) {
      return audio.fileDate;
    }
    if (audio.lastModified) {
      const dFromMod = new Date(audio.lastModified);
      if (!isNaN(dFromMod.getTime())) return dFromMod;
    }

    // Se não há hora nos metadados, usa o número sequencial WA como offset em minutos
    const num = parseInt(waNum, 10) % 720;
    const hour = Math.floor(num / 60) + 8; // Começa por volta das 08h
    const minute = num % 60;
    return new Date(year, month, day, hour, minute, 0);
  }

  // 4. Metadados nativos do arquivo (fileDate do ZIP ou lastModified do upload)
  if (audio.fileDate && !isNaN(audio.fileDate.getTime())) {
    return audio.fileDate;
  }
  if (audio.lastModified) {
    const dMod = new Date(audio.lastModified);
    if (!isNaN(dMod.getTime())) return dMod;
  }

  return null;
}

/**
 * Tenta inferir data e hora a partir do nome do arquivo
 */
function inferTimestampFromFileName(fileName: string, audio?: ExtractedAudioFile): string {
  if (audio) {
    const extractedDate = extractAudioTimestamp(audio);
    if (extractedDate) {
      return formatToWhatsAppTimestamp(extractedDate);
    }
  }

  // Formato YYYY-MM-DD-HH-MM-SS
  const matchIso = fileName.match(/(\d{4})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})(?:[-_](\d{2}))?/);
  if (matchIso) {
    const [, y, m, d, hh, mm, ss] = matchIso;
    return `${d}/${m}/${y}, ${hh}:${mm}${ss ? `:${ss}` : ''}`;
  }

  // Formato PTT/IMG/VID-YYYYMMDD-WA...
  const matchPtt = fileName.match(/(?:PTT|AUD|IMG|VID)-(\d{4})(\d{2})(\d{2})-WA(\d+)/i);
  if (matchPtt) {
    const [, y, m, d, num] = matchPtt;
    return `${d}/${m}/${y} (#${num})`;
  }

  return 'Data não especificada';
}

/**
 * Extrai o nome do arquivo de mídia (áudio, foto ou vídeo) mencionado no texto da mensagem
 */
function extractMediaNameFromContent(content: string, audioMap: Map<string, ExtractedAudioFile>): { candidate?: string; type?: 'audio' | 'image' | 'video' } {
  const contentLower = content.toLowerCase();

  // 1. Procura ocorrência exata de alguma das mídias no mapa (case-insensitive)
  for (const [key] of audioMap.entries()) {
    if (contentLower.includes(key.toLowerCase())) {
      const media = audioMap.get(key);
      const type = media?.mediaType || getMediaType(key);
      return { candidate: key, type };
    }
  }

  // 2. Procura padrões comuns de nomes de arquivo com extensões de mídia
  const match = content.match(/([A-Za-z0-9_\-\s]+\.(?:opus|ogg|m4a|mp3|wav|aac|amr|webm|mp4|jpg|jpeg|png|webp|gif|heic|3gp|mov))/i);
  if (match) {
    const found = match[1].trim();
    return { candidate: found, type: getMediaType(found) };
  }

  // 3. Marcações de foto / imagem sem nome explícito
  if (
    contentLower.includes('imagem ocultada') ||
    contentLower.includes('imagem omitida') ||
    contentLower.includes('foto ocultada') ||
    contentLower.includes('foto omitida') ||
    contentLower.includes('<imagem ocultada>') ||
    contentLower.includes('<foto ocultada>') ||
    contentLower.includes('imagem anexada') ||
    contentLower.includes('foto anexada') ||
    contentLower.includes('img-') ||
    contentLower.includes('photo-')
  ) {
    return { candidate: '__GENERIC_IMAGE__', type: 'image' };
  }

  // 4. Marcações de vídeo sem nome explícito
  if (
    contentLower.includes('vídeo ocultado') ||
    contentLower.includes('video ocultado') ||
    contentLower.includes('vídeo omitido') ||
    contentLower.includes('video omitido') ||
    contentLower.includes('<vídeo ocultado>') ||
    contentLower.includes('<video ocultado>') ||
    contentLower.includes('vídeo anexado') ||
    contentLower.includes('video anexado') ||
    contentLower.includes('vid-')
  ) {
    return { candidate: '__GENERIC_VIDEO__', type: 'video' };
  }

  // 5. Marcações de áudio sem nome explícito
  const isGenericAudio =
    contentLower.includes('arquivo de áudio') ||
    contentLower.includes('arquivo de audio') ||
    contentLower.includes('mensagem de voz') ||
    contentLower.includes('áudio oculto') ||
    contentLower.includes('audio oculto') ||
    contentLower.includes('mensagem de voz omitida') ||
    contentLower.includes('áudio omitido') ||
    contentLower.includes('audio omitido') ||
    contentLower.includes('arquivo de mídia oculto') ||
    contentLower.includes('arquivo de midia oculto') ||
    contentLower.includes('mídia oculta') ||
    contentLower.includes('midia oculta') ||
    contentLower.includes('(arquivo anexado)') ||
    contentLower.includes('<anexado:') ||
    contentLower.includes('ptt-') ||
    contentLower.includes('aud-') ||
    content.includes('<Áudio oculto>') ||
    content.includes('<Mensagem de voz');

  if (isGenericAudio) {
    return { candidate: '__GENERIC_AUDIO__', type: 'audio' };
  }

  return {};
}

/**
 * Analisa o texto do WhatsApp e correlaciona com os áudios extraídos
 * Mantém os horários exatos das mensagens e faz o De-Para inteligente para identificar os remetentes reais.
 */
export function parseWhatsAppChat(
  rawText: string,
  audioMap: Map<string, ExtractedAudioFile>
): ParsedChat {
  const lines = rawText.split(/\r?\n/);
  const messages: ChatMessage[] = [];
  const participantsSet = new Set<string>();
  const matchedAudiosSet = new Set<string>();

  let currentMsg: ChatMessage | null = null;
  let msgCounter = 1;
  let matchedByNameCount = 0;
  let matchedByTimestampCount = 0;

  // Popula os timestamps inferidos em cada áudio do mapa
  for (const audio of audioMap.values()) {
    if (!audio.inferredTimestamp) {
      const extracted = extractAudioTimestamp(audio);
      if (extracted) {
        audio.inferredTimestamp = extracted;
        audio.inferredTimestampStr = formatToWhatsAppTimestamp(extracted);
      }
    }
  }

  // ETAPA 1: Processa as linhas do arquivo de texto do WhatsApp
  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    let timestamp = '';
    let sender = '';
    let content = '';
    let isSystem = false;

    // Tenta formato iOS
    const iosMatch = cleanLine.match(IOS_LINE_REGEX);
    if (iosMatch) {
      timestamp = iosMatch[1];
      sender = iosMatch[2].trim();
      content = iosMatch[3].trim();
    } else {
      const iosSysMatch = cleanLine.match(IOS_SYSTEM_REGEX);
      if (iosSysMatch) {
        timestamp = iosSysMatch[1];
        sender = 'Sistema';
        content = iosSysMatch[2].trim();
        isSystem = true;
      }
    }

    // Tenta formato Android se não deu match no iOS
    if (!timestamp) {
      const androidMatch = cleanLine.match(ANDROID_LINE_REGEX);
      if (androidMatch) {
        timestamp = androidMatch[1];
        sender = androidMatch[2].trim();
        content = androidMatch[3].trim();
      } else {
        const androidSysMatch = cleanLine.match(ANDROID_SYSTEM_REGEX);
        if (androidSysMatch) {
          timestamp = androidSysMatch[1];
          sender = 'Sistema';
          content = androidSysMatch[2].trim();
          isSystem = true;
        }
      }
    }

    if (timestamp && (sender || isSystem)) {
      if (currentMsg) {
        messages.push(currentMsg);
      }

      if (!isSystem && sender) {
        participantsSet.add(sender);
      }

      const mediaCandidate = extractMediaNameFromContent(content, audioMap);
      let matchedMedia: ExtractedAudioFile | undefined;
      let isAudio = false;
      let isImage = false;
      let isVideo = false;
      let mediaType: 'audio' | 'image' | 'video' | 'text' = 'text';

      if (mediaCandidate.candidate) {
        if (!mediaCandidate.candidate.startsWith('__GENERIC_')) {
          matchedMedia = audioMap.get(mediaCandidate.candidate) || audioMap.get(mediaCandidate.candidate.toLowerCase());
          if (matchedMedia) {
            matchedAudiosSet.add(matchedMedia.name);
            matchedMedia.matchedSender = sender;
            matchedMedia.matchedReason = 'Nome exato do arquivo mencionado na conversa';
            matchedByNameCount++;
          }
        }

        const effectiveType = matchedMedia?.mediaType || mediaCandidate.type || (matchedMedia ? getMediaType(matchedMedia.name) : 'audio');
        if (effectiveType === 'image') {
          isImage = true;
          mediaType = 'image';
        } else if (effectiveType === 'video') {
          isVideo = true;
          mediaType = 'video';
        } else {
          isAudio = true;
          mediaType = 'audio';
        }
      }

      const parsedDate = parseWhatsAppTimestamp(timestamp);

      currentMsg = {
        id: `msg-${msgCounter++}`,
        rawLine: cleanLine,
        timestamp,
        timestampDate: parsedDate || undefined,
        sender,
        content,
        isAudio,
        isImage,
        isVideo,
        mediaType,
        audioFileName: matchedMedia ? matchedMedia.name : mediaCandidate.candidate && !mediaCandidate.candidate.startsWith('__GENERIC_') ? mediaCandidate.candidate : undefined,
        mediaFileName: matchedMedia ? matchedMedia.name : undefined,
        audioFile: matchedMedia,
        isSystem,
      };
    } else if (currentMsg) {
      // Linha de continuação
      currentMsg.content += `\n${cleanLine}`;
      currentMsg.rawLine += `\n${cleanLine}`;

      if (!currentMsg.isAudio && !currentMsg.isImage && !currentMsg.isVideo) {
        const mediaCandidate = extractMediaNameFromContent(cleanLine, audioMap);
        if (mediaCandidate.candidate) {
          const matched = audioMap.get(mediaCandidate.candidate) || audioMap.get(mediaCandidate.candidate.toLowerCase());
          if (matched) {
            const effType = matched.mediaType || mediaCandidate.type || getMediaType(matched.name);
            if (effType === 'image') {
              currentMsg.isImage = true;
              currentMsg.mediaType = 'image';
            } else if (effType === 'video') {
              currentMsg.isVideo = true;
              currentMsg.mediaType = 'video';
            } else {
              currentMsg.isAudio = true;
              currentMsg.mediaType = 'audio';
            }
            currentMsg.audioFileName = matched.name;
            currentMsg.mediaFileName = matched.name;
            currentMsg.audioFile = matched;
            matched.matchedSender = currentMsg.sender;
            matched.matchedReason = 'Nome exato em linha de anexo';
            matchedAudiosSet.add(matched.name);
            matchedByNameCount++;
          }
        }
      }
    } else {
      // Linha inicial sem timestamp
      messages.push({
        id: `msg-${msgCounter++}`,
        rawLine: cleanLine,
        timestamp: '',
        sender: 'Sistema',
        content: cleanLine,
        isAudio: false,
        isSystem: true,
      });
    }
  }

  if (currentMsg) {
    messages.push(currentMsg);
  }

  // ETAPA 2: DE-PARA INTELIGENTE POR HORÁRIOS (Áudios, Fotos e Vídeos)
  // Conecta mensagens de mídia com os arquivos pelo horário exato da mensagem
  const allUniqueAudios = Array.from(new Set(Array.from(audioMap.values())));
  let availableAudios = allUniqueAudios.filter((a) => !matchedAudiosSet.has(a.name));

  for (const msg of messages) {
    if ((msg.isAudio || msg.isImage || msg.isVideo) && !msg.audioFile && msg.timestampDate) {
      const msgTime = msg.timestampDate.getTime();

      // Procura a mídia com o horário mais próximo
      let bestCandidate: ExtractedAudioFile | null = null;
      let minDiffMs = Infinity;

      for (const candidate of availableAudios) {
        // Dá preferência ao mesmo tipo de mídia se conhecido
        const candType = candidate.mediaType || getMediaType(candidate.name);
        const typeMatches =
          (msg.isImage && candType === 'image') ||
          (msg.isVideo && candType === 'video') ||
          (msg.isAudio && candType === 'audio');

        const candDate = candidate.inferredTimestamp || candidate.fileDate || (candidate.lastModified ? new Date(candidate.lastModified) : null);
        if (candDate) {
          const diffMs = Math.abs(candDate.getTime() - msgTime);
          const score = typeMatches ? diffMs : diffMs + 60000; // Preferência de tipo
          if (diffMs <= 300000 && score < minDiffMs) {
            minDiffMs = score;
            bestCandidate = candidate;
          }
        }
      }

      if (bestCandidate) {
        msg.audioFileName = bestCandidate.name;
        msg.mediaFileName = bestCandidate.name;
        msg.audioFile = bestCandidate;
        msg.matchedByTimestamp = true;
        const candType = bestCandidate.mediaType || getMediaType(bestCandidate.name);
        if (candType === 'image') {
          msg.isImage = true;
          msg.mediaType = 'image';
        } else if (candType === 'video') {
          msg.isVideo = true;
          msg.mediaType = 'video';
        } else {
          msg.isAudio = true;
          msg.mediaType = 'audio';
        }
        bestCandidate.matchedSender = msg.sender;
        bestCandidate.inferredTimestampStr = msg.timestamp;
        bestCandidate.matchedReason = `Vinculado por horário (${msg.timestamp}) ao remetente ${msg.sender}`;
        matchedAudiosSet.add(bestCandidate.name);
        matchedByTimestampCount++;

        // Remove dos disponíveis
        availableAudios = availableAudios.filter((a) => a.name !== bestCandidate!.name);
      }
    }
  }

  // ETAPA 3: Mídias restantes com marcadores genéricos associadas por ordem
  for (const msg of messages) {
    if ((msg.isAudio || msg.isImage || msg.isVideo) && !msg.audioFile && availableAudios.length > 0) {
      const candidate = availableAudios.shift()!;
      msg.audioFileName = candidate.name;
      msg.mediaFileName = candidate.name;
      msg.audioFile = candidate;
      const candType = candidate.mediaType || getMediaType(candidate.name);
      if (candType === 'image') {
        msg.isImage = true;
        msg.mediaType = 'image';
      } else if (candType === 'video') {
        msg.isVideo = true;
        msg.mediaType = 'video';
      } else {
        msg.isAudio = true;
        msg.mediaType = 'audio';
      }
      candidate.matchedSender = msg.sender;
      candidate.inferredTimestampStr = msg.timestamp;
      candidate.matchedReason = `Vinculado na ordem da conversa (${msg.timestamp}) com ${msg.sender}`;
      matchedAudiosSet.add(candidate.name);
    }
  }

  // ETAPA 4: Mídias (áudios, fotos, vídeos) presentes no ZIP/upload sem mensagem de texto correspondente
  // MANTÉM A MESMA HORA: insere na linha do tempo exatamente no horário em que foram criadas/modificadas!
  const remainingAudios = allUniqueAudios.filter((a) => !matchedAudiosSet.has(a.name));

  for (const remaining of remainingAudios) {
    const audioDate = remaining.inferredTimestamp || (remaining.lastModified ? new Date(remaining.lastModified) : null);
    const timeStr = audioDate ? formatToWhatsAppTimestamp(audioDate) : inferTimestampFromFileName(remaining.name, remaining);
    const mType = remaining.mediaType || getMediaType(remaining.name);

    // Tenta identificar quem estava falando no chat naquele mesmo horário
    let inferredSender = mType === 'image' ? 'Foto / Imagem' : mType === 'video' ? 'Vídeo Anexo' : 'Nota de Voz / Áudio';
    if (audioDate) {
      const audioMs = audioDate.getTime();
      let closestMsg: ChatMessage | null = null;
      let minDelta = Infinity;

      for (const m of messages) {
        if (!m.isSystem && m.timestampDate && m.sender) {
          const delta = Math.abs(m.timestampDate.getTime() - audioMs);
          if (delta < minDelta && delta <= 300000) { // Até 5 minutos
            minDelta = delta;
            closestMsg = m;
          }
        }
      }

      if (closestMsg) {
        inferredSender = closestMsg.sender;
        remaining.matchedSender = closestMsg.sender;
        remaining.matchedReason = `Identificado pelo horário de envio aproximado às ${closestMsg.timestamp}`;
      }
    }

    const typeDesc = mType === 'image' ? 'Foto / Imagem' : mType === 'video' ? 'Vídeo' : 'Mensagem de áudio';

    messages.push({
      id: `media-extra-${msgCounter++}`,
      rawLine: `[${timeStr}] ${inferredSender}: [${typeDesc}: ${remaining.name}]`,
      timestamp: timeStr,
      timestampDate: audioDate || undefined,
      sender: inferredSender,
      content: `[${typeDesc}: ${remaining.name}]`,
      isAudio: mType === 'audio',
      isImage: mType === 'image',
      isVideo: mType === 'video',
      mediaType: mType,
      audioFileName: remaining.name,
      mediaFileName: remaining.name,
      audioFile: remaining,
      isSystem: false,
      matchedByTimestamp: true,
    });
  }

  // ETAPA 5: Ordena TODAS as mensagens cronologicamente preservando a linha do tempo e as mesmas horas
  messages.sort((a, b) => {
    if (a.timestampDate && b.timestampDate) {
      return a.timestampDate.getTime() - b.timestampDate.getTime();
    }
    return 0;
  });

  const totalAudios = messages.filter((m) => m.isAudio).length;

  return {
    messages,
    participants: Array.from(participantsSet),
    totalAudiosInChat: totalAudios,
    unlinkedAudios: remainingAudios,
    matchedAudiosCount: matchedByNameCount + matchedByTimestampCount,
    matchedByTimestampCount,
  };
}
