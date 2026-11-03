import { ParsedChat } from './chatParser';
import { ExtractedAudioFile } from './zipParser';

/**
 * Gera um WAV de áudio sintético no navegador (tom audível curto)
 * para garantir que o player de áudio funcione perfeitamente no teste
 */
function createSyntheticAudioBlob(durationSeconds: number = 2, freq: number = 440): Blob {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.3 * Math.exp(-t * 0.5);
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function createSampleImageBlob(): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260">
    <rect width="100%" height="100%" fill="#18181b"/>
    <rect x="20" y="20" width="360" height="220" rx="12" fill="#27272a" stroke="#10b981" stroke-width="2"/>
    <text x="50%" y="40%" text-anchor="middle" fill="#10b981" font-family="sans-serif" font-size="15" font-weight="bold">CONTRATO / CRONOGRAMA DE ENTREGA</text>
    <text x="50%" y="55%" text-anchor="middle" fill="#e4e4e7" font-family="sans-serif" font-size="13">Status: Aprovado pela diretoria</text>
    <text x="50%" y="70%" text-anchor="middle" fill="#a1a1aa" font-family="sans-serif" font-size="11">Data limite: 15/05/2024 às 18:00 - Assinado digitalmente</text>
  </svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

export function createSampleBabadoChat(): { parsed: ParsedChat; zipName: string } {
  const audioBlob1 = createSyntheticAudioBlob(3, 300);
  const audioBlob2 = createSyntheticAudioBlob(4, 420);
  const audioBlob3 = createSyntheticAudioBlob(3.5, 360);
  const photoBlob1 = createSampleImageBlob();

  const audio1: ExtractedAudioFile = {
    name: 'AUDIO-2024-05-12-14-33-05.opus',
    cleanName: 'audio-2024-05-12-14-33-05.opus',
    blob: audioBlob1,
    objectUrl: URL.createObjectURL(audioBlob1),
    size: audioBlob1.size,
    mimeType: 'audio/wav',
    mediaType: 'audio',
    durationSeconds: 3,
    status: 'completed',
    userNotes: 'Gravação de conversa entre 2 pessoas sobre a antecipação de prazo',
    hasMultipleSpeakers: true,
    speakersDetected: ['Felipe', 'Mariana'],
    transcription: '[Felipe]: Oi Mariana, acabei de falar com o cliente e eles solicitaram adiantar a entrega do relatório para quarta-feira.\n[Mariana]: Perfeito Felipe, vou ajustar as métricas e consolidar a apresentação hoje mesmo.',
    modelUsed: 'gemini-3.5-transcribe',
  };

  const photo1: ExtractedAudioFile = {
    name: 'IMG-20240512-WA0001.jpg',
    cleanName: 'img-20240512-wa0001.jpg',
    blob: photoBlob1,
    objectUrl: URL.createObjectURL(photoBlob1),
    size: photoBlob1.size,
    mimeType: 'image/svg+xml',
    mediaType: 'image',
    status: 'completed',
    analysis: 'Documento oficial de "CONTRATO / CRONOGRAMA DE ENTREGA". Contém carimbo de aprovação da diretoria com data limite fixada para 15/05/2024 às 18:00 e assinatura digital válida.',
    modelUsed: 'gemini-3.8-flash',
  };

  const audio2: ExtractedAudioFile = {
    name: 'PTT-20240512-WA0002.opus',
    cleanName: 'ptt-20240512-wa0002.opus',
    blob: audioBlob2,
    objectUrl: URL.createObjectURL(audioBlob2),
    size: audioBlob2.size,
    mimeType: 'audio/wav',
    mediaType: 'audio',
    durationSeconds: 4,
    status: 'completed',
    transcription: 'Perfeito, vou revisar a planilha agora mesmo e atualizar o documento para todos.',
    modelUsed: 'gemini-3.5-transcribe',
  };

  const audio3: ExtractedAudioFile = {
    name: 'AUDIO-2024-05-12-14-41-20.opus',
    cleanName: 'audio-2024-05-12-14-41-20.opus',
    blob: audioBlob3,
    objectUrl: URL.createObjectURL(audioBlob3),
    size: audioBlob3.size,
    mimeType: 'audio/wav',
    mediaType: 'audio',
    durationSeconds: 3,
    status: 'idle',
    userNotes: 'Gravação de 2 ou mais pessoas na sala de reunião',
    hasMultipleSpeakers: true,
    transcription: undefined,
  };

  const messages = [
    {
      id: 'm-1',
      rawLine: '12/05/2024, 14:30 - As mensagens e as chamadas são protegidas com a criptografia de ponta a ponta.',
      timestamp: '12/05/2024, 14:30',
      sender: 'Sistema',
      content: 'As mensagens e as chamadas são protegidas com a criptografia de ponta a ponta.',
      isAudio: false,
      isSystem: true,
    },
    {
      id: 'm-2',
      rawLine: '12/05/2024, 14:31 - Felipe: Oi gente, vocês viram a novidade sobre o novo prazo da entrega final?',
      timestamp: '12/05/2024, 14:31',
      sender: 'Felipe',
      content: 'Oi gente, vocês viram a novidade sobre o novo prazo da entrega final?',
      isAudio: false,
      isSystem: false,
    },
    {
      id: 'm-3',
      rawLine: '12/05/2024, 14:32 - Mariana: Nossa, não acredito! O que aconteceu dessa vez?',
      timestamp: '12/05/2024, 14:32',
      sender: 'Mariana',
      content: 'Nossa, não acredito! O que aconteceu dessa vez?',
      isAudio: false,
      isSystem: false,
    },
    {
      id: 'm-4',
      rawLine: '12/05/2024, 14:33 - Felipe: AUDIO-2024-05-12-14-33-05.opus (arquivo anexado)',
      timestamp: '12/05/2024, 14:33',
      sender: 'Felipe',
      content: 'AUDIO-2024-05-12-14-33-05.opus (arquivo anexado)',
      isAudio: true,
      mediaType: 'audio' as const,
      audioFileName: audio1.name,
      mediaFileName: audio1.name,
      audioFile: audio1,
      isSystem: false,
    },
    {
      id: 'm-4-img',
      rawLine: '12/05/2024, 14:34 - Felipe: IMG-20240512-WA0001.jpg (arquivo anexado)',
      timestamp: '12/05/2024, 14:34',
      sender: 'Felipe',
      content: 'IMG-20240512-WA0001.jpg (arquivo anexado)',
      isAudio: false,
      isImage: true,
      mediaType: 'image' as const,
      mediaFileName: photo1.name,
      audioFile: photo1,
      isSystem: false,
    },
    {
      id: 'm-5',
      rawLine: '12/05/2024, 14:35 - Roberto: Caramba! Então anteciparam tudo para a próxima quarta-feira?',
      timestamp: '12/05/2024, 14:35',
      sender: 'Roberto',
      content: 'Caramba! Então anteciparam tudo para a próxima quarta-feira?',
      isAudio: false,
      isSystem: false,
    },
    {
      id: 'm-6',
      rawLine: '12/05/2024, 14:36 - Mariana: PTT-20240512-WA0002.opus (arquivo anexado)',
      timestamp: '12/05/2024, 14:36',
      sender: 'Mariana',
      content: 'PTT-20240512-WA0002.opus (arquivo anexado)',
      isAudio: true,
      mediaType: 'audio' as const,
      audioFileName: audio2.name,
      mediaFileName: audio2.name,
      audioFile: audio2,
      isSystem: false,
    },
    {
      id: 'm-7',
      rawLine: '12/05/2024, 14:39 - Felipe: Exatamente, temos que fechar a parte de transcrição e exportação ainda hoje.',
      timestamp: '12/05/2024, 14:39',
      sender: 'Felipe',
      content: 'Exatamente, temos que fechar a parte de transcrição e exportação ainda hoje.',
      isAudio: false,
      isSystem: false,
    },
    {
      id: 'm-8',
      rawLine: '12/05/2024, 14:41 - Roberto: AUDIO-2024-05-12-14-41-20.opus (arquivo anexado)',
      timestamp: '12/05/2024, 14:41',
      sender: 'Roberto',
      content: 'AUDIO-2024-05-12-14-41-20.opus (arquivo anexado)',
      isAudio: true,
      mediaType: 'audio' as const,
      audioFileName: audio3.name,
      mediaFileName: audio3.name,
      audioFile: audio3,
      isSystem: false,
    },
    {
      id: 'm-9',
      rawLine: '12/05/2024, 14:44 - Mariana: Perfeito! Vou gerar o relatório em TXT completo para mandar à diretoria.',
      timestamp: '12/05/2024, 14:44',
      sender: 'Mariana',
      content: 'Perfeito! Vou gerar o relatório em TXT completo para mandar à diretoria.',
      isAudio: false,
      isSystem: false,
    },
  ];

  return {
    parsed: {
      messages,
      participants: ['Felipe', 'Mariana', 'Roberto'],
      totalAudiosInChat: 4,
      unlinkedAudios: [],
    },
    zipName: 'Conversa_WhatsApp_Multimodal.zip',
  };
}
