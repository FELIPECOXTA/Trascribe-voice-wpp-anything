import { ChatMessage, ParsedChat } from './chatParser';

/**
 * Gera o texto completo unificado com a linha do tempo cronológica e áudios transcritos
 */
export function generateUnifiedTxt(
  parsedChat: ParsedChat,
  sourceZipName: string = 'TRANSCREVA_TUDO.zip'
): string {
  const now = new Date().toLocaleString('pt-BR');
  const totalMsgs = parsedChat.messages.length;
  const audioMsgs = parsedChat.messages.filter((m) => m.isAudio);
  const transcribedCount = audioMsgs.filter((m) => m.audioFile?.transcription).length;
  const participantsStr = parsedChat.participants.length > 0
    ? parsedChat.participants.join(', ')
    : 'Não identificados';

  const deParaStatus = parsedChat.matchedByTimestampCount && parsedChat.matchedByTimestampCount > 0
    ? `Sincronização De-Para: Ativa (${parsedChat.matchedByTimestampCount} áudios vinculados aos horários e remetentes reais)`
    : 'Sincronização: Linha do tempo cronológica preservada';

  const header = [
    '================================================================================',
    'HISTÓRICO COMPLETO DA CONVERSA INTEGRADA COM TRANSCRIÇÃO DE ÁUDIOS (TRANSCREVA TUDO)',
    `Arquivo de Origem: ${sourceZipName}`,
    `Data da Extração: ${now}`,
    deParaStatus,
    `Total de Mensagens: ${totalMsgs} | Total de Áudios: ${audioMsgs.length} (Transcritos: ${transcribedCount})`,
    `Participantes: ${participantsStr}`,
    '================================================================================',
    '',
  ].join('\n');

  const lines = parsedChat.messages.map((msg) => {
    const timeStr = msg.timestamp ? `[${msg.timestamp}] ` : '';
    const senderStr = msg.sender ? `${msg.sender}: ` : '';

    if (msg.isImage) {
      const media = msg.audioFile;
      const fileNameStr = msg.mediaFileName || msg.audioFileName || media?.name || 'Foto Anexa';
      if (media?.analysis) {
        return `${timeStr}${senderStr}[Foto/Imagem - ${fileNameStr}]:\n[Leitura de Texto (OCR) & Análise Visual]:\n"${media.analysis}"\n`;
      } else {
        return `${timeStr}${senderStr}[Foto/Imagem - ${fileNameStr}]`;
      }
    }

    if (msg.isVideo) {
      const media = msg.audioFile;
      const fileNameStr = msg.mediaFileName || msg.audioFileName || media?.name || 'Vídeo Anexo';
      if (media?.analysis || media?.transcription) {
        return `${timeStr}${senderStr}[Vídeo - ${fileNameStr}]:\n[Transcrição & Análise Visual]:\n"${media.analysis || media.transcription}"\n`;
      } else {
        return `${timeStr}${senderStr}[Vídeo - ${fileNameStr}]`;
      }
    }

    if (msg.isAudio) {
      const audio = msg.audioFile;
      const fileNameStr = msg.audioFileName || audio?.name || 'Áudio Anexo';
      const notesBlock = audio?.userNotes ? `[Observação do Áudio: "${audio.userNotes}"]\n` : '';
      const speakersBlock = audio?.speakersDetected && audio.speakersDetected.length > 1
        ? `[Interlocutores Reconhecidos: ${audio.speakersDetected.join(', ')}]\n`
        : '';
      
      if (audio?.transcription) {
        return `${timeStr}${senderStr}[Áudio Transcrito - ${fileNameStr}]:\n${notesBlock}${speakersBlock}"${audio.transcription}"\n`;
      } else if (audio?.status === 'transcribing') {
        return `${timeStr}${senderStr}[Áudio em transcrição - ${fileNameStr}]${notesBlock ? ' ' + notesBlock.trim() : ''}`;
      } else if (audio?.status === 'error') {
        return `${timeStr}${senderStr}[Áudio - ${fileNameStr} (Falha na transcrição: ${audio.errorMessage || 'erro'})]`;
      } else {
        return `${timeStr}${senderStr}[Áudio Pendente de Transcrição - ${fileNameStr}]${notesBlock ? ' ' + notesBlock.trim() : ''}`;
      }
    }

    if (msg.isSystem) {
      return `${timeStr}[Sistema] ${msg.content}`;
    }

    return `${timeStr}${senderStr}${msg.content}`;
  });

  return header + lines.join('\n');
}

/**
 * Gera o histórico completo estruturado em JSON com metadados e transcrições
 */
export function generateJsonExport(
  parsedChat: ParsedChat,
  sourceZipName: string = 'TRANSCREVA_TUDO.zip'
): string {
  const totalMsgs = parsedChat.messages.length;
  const audioMsgs = parsedChat.messages.filter((m) => m.isAudio);
  const transcribedCount = audioMsgs.filter((m) => m.audioFile?.transcription).length;

  const exportData = {
    metadata: {
      sourceFile: sourceZipName,
      exportedAt: new Date().toISOString(),
      totalMessages: totalMsgs,
      totalAudios: audioMsgs.length,
      transcribedAudios: transcribedCount,
      participants: parsedChat.participants,
    },
    messages: parsedChat.messages.map((m) => ({
      id: m.id,
      timestamp: m.timestamp,
      sender: m.sender,
      isSystem: m.isSystem,
      type: m.isAudio ? 'audio' : m.isSystem ? 'system' : 'text',
      content: m.content,
      audioFileName: m.audioFileName || m.audioFile?.name || null,
      audioTranscription: m.audioFile?.transcription || null,
      audioNotes: m.audioFile?.userNotes || null,
      audioSpeakers: m.audioFile?.speakersDetected || [],
      audioStatus: m.audioFile?.status || null,
      audioSizeBytes: m.audioFile?.size || null,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Helper para escapar campos no CSV
 */
function escapeCsv(val: string | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Gera o histórico em formato CSV compatível com Excel e Google Sheets
 */
export function generateCsvExport(
  parsedChat: ParsedChat,
  sourceZipName: string = 'TRANSCREVA_TUDO.zip'
): string {
  const headers = [
    'ID',
    'Data_Hora',
    'Participante',
    'Tipo',
    'Mensagem_Texto',
    'Arquivo_Audio',
    'Transcricao_Audio',
    'Observacao_Audio',
    'Interlocutores',
    'Status_Audio',
    'Tamanho_Bytes',
  ];

  const rows = parsedChat.messages.map((m) => {
    return [
      escapeCsv(m.id),
      escapeCsv(m.timestamp),
      escapeCsv(m.sender),
      escapeCsv(m.isAudio ? 'audio' : m.isSystem ? 'sistema' : 'texto'),
      escapeCsv(m.content),
      escapeCsv(m.audioFileName || m.audioFile?.name || ''),
      escapeCsv(m.audioFile?.transcription || ''),
      escapeCsv(m.audioFile?.userNotes || ''),
      escapeCsv(m.audioFile?.speakersDetected ? m.audioFile.speakersDetected.join('; ') : ''),
      escapeCsv(m.audioFile?.status || ''),
      escapeCsv(m.audioFile?.size ? String(m.audioFile.size) : ''),
    ].join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF) para garantir que o Microsoft Excel abra caracteres acentuados corretamente
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Dispara o download de qualquer arquivo de exportação no navegador
 */
export function downloadExportFile(
  content: string,
  fileName: string,
  mimeType: string = 'text/plain'
) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download legado de TXT
 */
export function downloadTxtFile(content: string, fileName: string = 'conversa_babado_transcrita.txt') {
  downloadExportFile(content, fileName, 'text/plain');
}

/**
 * Copia o texto para a área de transferência
 */
export async function copyTxtToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch (err) {
    console.error('Falha ao copiar para área de transferência:', err);
    return false;
  }
}
