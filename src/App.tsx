import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  FileArchive,
  Cloud,
  Sparkles,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Headphones,
  Users,
  MessageSquare,
  Mic,
  Clock,
} from 'lucide-react';
import { initAuth, googleSignIn, logout } from './services/firebase';
import {
  unpackZipFile,
  RawZipContent,
  ExtractedAudioFile,
  detectAudioDuration,
  isAudioFileName,
  isMediaFileName,
  getMimeTypeForMedia,
  getMediaType,
} from './services/zipParser';
import { parseWhatsAppChat, ParsedChat, ChatMessage } from './services/chatParser';
import {
  processAudioQueue,
  transcribeSingleAudio,
  analyzeSingleMedia,
  QueueProgress,
} from './services/transcriber';
import { generateUnifiedTxt } from './services/txtExporter';
import { createSampleBabadoChat } from './services/sampleData';
import { Navbar } from './components/Navbar';
import { DriveModal } from './components/DriveModal';
import { PlatformHub } from './components/PlatformHub';
import { AudioRecorderModal } from './components/AudioRecorderModal';
import { TranscriptionQueue } from './components/TranscriptionQueue';
import { ChatViewer } from './components/ChatViewer';
import { TxtExportModal } from './components/TxtExportModal';
import { PricingModal } from './components/PricingModal';
import { DeParaModal } from './components/DeParaModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { BillingState, getStoredBilling, consumeFreeTrialQuota } from './services/billing';
import { shareAppOnWhatsApp } from './services/shareHelper';

export default function App() {
  // Billing & Paywall state
  const [billingState, setBillingState] = useState<BillingState>(() => getStoredBilling());
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Modals state
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isRecorderModalOpen, setIsRecorderModalOpen] = useState(false);
  const [isTxtModalOpen, setIsTxtModalOpen] = useState(false);
  const [isDeParaModalOpen, setIsDeParaModalOpen] = useState(false);
  const [showDeParaConfirmBeforeTranscribe, setShowDeParaConfirmBeforeTranscribe] = useState(false);

  // ZIP & Chat processing state
  const [isProcessingZip, setIsProcessingZip] = useState(false);
  const [zipStatusMessage, setZipStatusMessage] = useState('');
  const [zipName, setZipName] = useState<string>('');
  const [rawZip, setRawZip] = useState<RawZipContent | null>(null);
  const [parsedChat, setParsedChat] = useState<ParsedChat | null>(null);
  const [audiosList, setAudiosList] = useState<ExtractedAudioFile[]>([]);

  // Transcription queue state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [queueProgress, setQueueProgress] = useState<QueueProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Active view tab: 'chat' | 'queue'
  const [activeTab, setActiveTab] = useState<'chat' | 'queue'>('chat');

  // Inicializa o listener de autenticação
  useEffect(() => {
    initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      console.error('Falha na autenticação:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
  };

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Processa o arquivo ZIP extraído (Buffer ou File)
   */
  const processZipData = async (data: ArrayBuffer | File, name: string) => {
    setIsProcessingZip(true);
    setErrorMessage(null);
    setZipStatusMessage('Descompactando arquivo ZIP...');
    try {
      const unpacked = await unpackZipFile(data, name, (pct) => {
        setZipStatusMessage(`Extraindo arquivos: ${pct}%`);
      });

      setRawZip(unpacked);
      setZipName(name);

      setZipStatusMessage('Analisando histórico de mensagens e vinculando áudios...');
      const chat = parseWhatsAppChat(unpacked.chatContent, unpacked.audios);
      setParsedChat(chat);

      const uniqueAudios = Array.from(new Set(Array.from(unpacked.audios.values())));
      setAudiosList(uniqueAudios);
      setActiveTab('chat');
    } catch (err: any) {
      console.error('Erro ao processar arquivo ZIP:', err);
      setErrorMessage(`Falha ao descompactar o arquivo ZIP: ${err.message || 'Arquivo corrompido ou formato inválido'}`);
    } finally {
      setIsProcessingZip(false);
      setZipStatusMessage('');
    }
  };

  /**
   * Processa múltiplos arquivos selecionados de qualquer plataforma (ZIP ou áudios avulsos)
   */
  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setErrorMessage(null);

    // Se houver arquivo .zip
    const zipFile = files.find((f) => f.name.toLowerCase().endsWith('.zip'));
    if (zipFile) {
      return processZipData(zipFile, zipFile.name);
    }

    const txtFile = files.find((f) => f.name.toLowerCase().endsWith('.txt'));
    const mediaFiles = files.filter((f) => isMediaFileName(f.name));

    // Se o usuário selecionou o .txt da conversa junto com áudios, fotos ou vídeos avulsos
    if (txtFile && mediaFiles.length > 0) {
      setIsProcessingZip(true);
      setZipStatusMessage(`Processando conversa ${txtFile.name} e ${mediaFiles.length} arquivos de mídia (áudios, fotos e vídeos)...`);
      try {
        const text = await txtFile.text();
        const audioMap = new Map<string, ExtractedAudioFile>();
        const extractedList: ExtractedAudioFile[] = [];

        for (const file of mediaFiles) {
          const mediaType = getMediaType(file.name);
          const mimeType = getMimeTypeForMedia(file.name);
          const blob = file;
          const objectUrl = URL.createObjectURL(blob);
          let dur: number | undefined;

          if (mediaType === 'audio' || mediaType === 'video') {
            dur = await detectAudioDuration(objectUrl);
          }

          const item: ExtractedAudioFile = {
            name: file.name,
            cleanName: file.name.toLowerCase(),
            blob,
            objectUrl,
            size: file.size,
            mimeType,
            mediaType,
            durationSeconds: dur,
            status: 'idle',
            fileDate: new Date(file.lastModified || Date.now()),
            lastModified: file.lastModified || Date.now(),
          };
          extractedList.push(item);
          audioMap.set(file.name, item);
          audioMap.set(file.name.toLowerCase(), item);
        }

        const chat = parseWhatsAppChat(text, audioMap);
        setZipName(txtFile.name);
        setAudiosList(extractedList);
        setParsedChat(chat);
        setActiveTab('chat');
      } catch (err: any) {
        console.error('Erro ao processar TXT + Mídias:', err);
        setErrorMessage(`Falha ao ler arquivos: ${err.message || 'Erro inesperado'}`);
      } finally {
        setIsProcessingZip(false);
        setZipStatusMessage('');
      }
      return;
    }

    // Se o usuário já tem mídias carregadas e subiu um arquivo .txt avulso
    if (txtFile && mediaFiles.length === 0 && audiosList.length > 0) {
      setIsProcessingZip(true);
      setZipStatusMessage(`Executando De-Para de horários com ${txtFile.name}...`);
      try {
        const text = await txtFile.text();
        const audioMap = new Map<string, ExtractedAudioFile>();
        for (const a of audiosList) {
          audioMap.set(a.name, a);
          audioMap.set(a.cleanName, a);
        }
        const chat = parseWhatsAppChat(text, audioMap);
        setZipName((prev) => (prev ? `${prev} + ${txtFile.name}` : txtFile.name));
        setParsedChat(chat);
        setActiveTab('chat');
      } catch (err: any) {
        setErrorMessage(`Erro ao aplicar De-Para do TXT: ${err.message || err}`);
      } finally {
        setIsProcessingZip(false);
        setZipStatusMessage('');
      }
      return;
    }

    // Se forem arquivos de mídia avulsos (áudios, fotos ou vídeos)
    if (mediaFiles.length === 0) {
      setErrorMessage('Nenhum arquivo de áudio, foto, vídeo ou conversa compatível encontrado. Envie arquivos .zip, .txt, .opus, .ogg, .mp3, .m4a, .jpg, .png ou .mp4.');
      return;
    }

    setIsProcessingZip(true);
    setZipStatusMessage(`Carregando ${mediaFiles.length} arquivos de mídia...`);

    const extractedList: ExtractedAudioFile[] = [];
    const messages: ChatMessage[] = [];
    let counter = 1;

    for (const file of mediaFiles) {
      const mediaType = getMediaType(file.name);
      const mimeType = getMimeTypeForMedia(file.name);
      const blob = file;
      const objectUrl = URL.createObjectURL(blob);
      let dur: number | undefined;

      if (mediaType === 'audio' || mediaType === 'video') {
        dur = await detectAudioDuration(objectUrl);
      }

      const item: ExtractedAudioFile = {
        name: file.name,
        cleanName: file.name.toLowerCase(),
        blob,
        objectUrl,
        size: file.size,
        mimeType,
        mediaType,
        durationSeconds: dur,
        status: 'idle',
        fileDate: new Date(file.lastModified || Date.now()),
        lastModified: file.lastModified || Date.now(),
      };
      extractedList.push(item);

      const now = new Date(file.lastModified || Date.now());
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const senderLabel = mediaType === 'image' ? 'Foto / Imagem' : mediaType === 'video' ? 'Vídeo Anexo' : 'Nota de Voz / Áudio';

      messages.push({
        id: `media-msg-${counter++}`,
        rawLine: `[${dateStr}, ${timeStr}] ${senderLabel}: ${file.name}`,
        timestamp: `${dateStr}, ${timeStr}`,
        timestampDate: now,
        sender: senderLabel,
        content: `[Arquivo: ${file.name}]`,
        isAudio: mediaType === 'audio',
        isImage: mediaType === 'image',
        isVideo: mediaType === 'video',
        mediaType,
        audioFileName: file.name,
        mediaFileName: file.name,
        audioFile: item,
        isSystem: false,
      });
    }

    setZipName(mediaFiles.length === 1 ? mediaFiles[0].name : `${mediaFiles.length} Mídias Importadas`);
    setAudiosList(extractedList);
    setParsedChat({
      messages,
      participants: ['Nota de Voz / Áudio'],
      totalAudiosInChat: extractedList.length,
      unlinkedAudios: [],
      matchedAudiosCount: 0,
      matchedByTimestampCount: 0,
    });
    setIsProcessingZip(false);
    setZipStatusMessage('');
    setActiveTab('chat');
  };

  /**
   * Aplica os resultados do De-Para de horários e remetentes
   */
  const handleApplyDePara = (newChat: ParsedChat, sourceName: string) => {
    setParsedChat(newChat);
    setZipName((prev) => (prev ? `${prev} + ${sourceName}` : sourceName));
    const unique = Array.from(new Set(newChat.messages.filter((m) => m.audioFile).map((m) => m.audioFile!)));
    if (unique.length > 0) {
      setAudiosList(unique);
    }
    setActiveTab('chat');
    setIsDeParaModalOpen(false);
  };

  /**
   * Adiciona áudio gravado no microfone ao chat
   */
  const handleAudioRecorded = async (blob: Blob, fileName: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const dur = await detectAudioDuration(objectUrl);
    const item: ExtractedAudioFile = {
      name: fileName,
      cleanName: fileName.toLowerCase(),
      blob,
      objectUrl,
      size: blob.size,
      mimeType: blob.type || 'audio/webm',
      durationSeconds: dur,
      status: 'idle',
    };

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const newMsg: ChatMessage = {
      id: `rec-msg-${Date.now()}`,
      rawLine: `[${dateStr}, ${timeStr}] Gravação Microfone: ${fileName}`,
      timestamp: `${dateStr}, ${timeStr}`,
      sender: 'Gravação Direta',
      content: `[Gravação de áudio: ${fileName}]`,
      isAudio: true,
      audioFileName: fileName,
      audioFile: item,
      isSystem: false,
    };

    setAudiosList((prev) => [item, ...prev]);
    setParsedChat((prev) => {
      if (prev) {
        return {
          ...prev,
          messages: [newMsg, ...prev.messages],
          totalAudiosInChat: prev.totalAudiosInChat + 1,
        };
      }
      return {
        messages: [newMsg],
        participants: ['Gravação Direta'],
        totalAudiosInChat: 1,
        unlinkedAudios: [],
      };
    });

    if (!zipName) {
      setZipName(fileName);
    }
    setActiveTab('chat');
  };

  // Carrega demonstração para teste imediato
  const handleLoadDemo = () => {
    const demo = createSampleBabadoChat();
    setZipName(demo.zipName);
    setParsedChat(demo.parsed);
    const uniqueAudios = Array.from(
      new Set(demo.parsed.messages.filter((m) => m.audioFile).map((m) => m.audioFile!))
    );
    setAudiosList(uniqueAudios);
    setActiveTab('chat');
  };

  // Executa a fila de transcrição efetivamente
  const executeTranscriptionActual = async () => {
    if (audiosList.length === 0 || isTranscribing) return;

    // Verifica cota disponível se não for premium
    if (!billingState.isPremium && billingState.freeTrialAudiosUsed >= billingState.freeTrialAudiosTotal) {
      setIsPricingModalOpen(true);
      return;
    }

    setIsTranscribing(true);
    abortControllerRef.current = new AbortController();

    try {
      await processAudioQueue(
        audiosList,
        1,
        (prog) => setQueueProgress(prog),
        (updatedAudio) => {
          if (updatedAudio.status === 'completed') {
            consumeFreeTrialQuota();
            setBillingState(getStoredBilling());
          }

          setAudiosList((prev) =>
            prev.map((a) => (a.name === updatedAudio.name ? { ...updatedAudio } : a))
          );
          setParsedChat((prev) => {
            if (!prev) return null;
            const updatedMessages = prev.messages.map((m) => {
              if (m.audioFile?.name === updatedAudio.name) {
                return {
                  ...m,
                  audioFile: { ...updatedAudio },
                };
              }
              return m;
            });
            return {
              ...prev,
              messages: updatedMessages,
            };
          });
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      console.error('Erro no processamento da fila de transcrição:', err);
    } finally {
      setIsTranscribing(false);
      abortControllerRef.current = null;
    }
  };

  // Inicia transcrição verificando se o usuário precisa vincular o TXT antes para não perder as horas
  const handleStartTranscription = async () => {
    if (audiosList.length === 0 || isTranscribing) return;

    // Se o usuário ainda não vinculou o arquivo TXT da conversa, alerta para não perder as horas
    const hasTextMessages = parsedChat?.messages.some((m) => !m.isAudio && !m.isSystem);
    if (!hasTextMessages && !rawZip?.chatContent) {
      setShowDeParaConfirmBeforeTranscribe(true);
      return;
    }

    executeTranscriptionActual();
  };

  // Pausa a fila de transcrição
  const handlePauseTranscription = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsTranscribing(false);
    }
  };

  // Analisa uma mídia (foto ou vídeo) sob demanda (OCR, leitura visual e transcrição)
  const handleAnalyzeSingleMedia = async (media: ExtractedAudioFile) => {
    // Verifica cota disponível
    if (!billingState.isPremium && billingState.freeTrialAudiosUsed >= billingState.freeTrialAudiosTotal) {
      setIsPricingModalOpen(true);
      return;
    }

    setErrorMessage(null);
    media.status = 'transcribing';
    media.errorMessage = undefined;
    setAudiosList((prev) => prev.map((a) => (a.name === media.name ? { ...a, status: 'transcribing' } : a)));

    try {
      const result = await analyzeSingleMedia(media);
      media.analysis = result.analysis;
      if (result.transcription) {
        media.transcription = result.transcription;
      }
      media.modelUsed = result.modelUsed;
      media.status = 'completed';

      consumeFreeTrialQuota();
      setBillingState(getStoredBilling());

      setAudiosList((prev) =>
        prev.map((a) => (a.name === media.name ? { ...media, status: 'completed' } : a))
      );

      setParsedChat((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.audioFile?.name === media.name || m.mediaFileName === media.name
              ? { ...m, audioFile: { ...media, status: 'completed' } }
              : m
          ),
        };
      });
    } catch (err: any) {
      const errMsg = err.message || 'Erro na análise da mídia';
      media.status = 'error';
      media.errorMessage = errMsg;
      setAudiosList((prev) =>
        prev.map((a) => (a.name === media.name ? { ...a, status: 'error', errorMessage: errMsg } : a))
      );
      setParsedChat((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.audioFile?.name === media.name || m.mediaFileName === media.name
              ? { ...m, audioFile: { ...media, status: 'error', errorMessage: errMsg } }
              : m
          ),
        };
      });
      setErrorMessage(`Não foi possível analisar "${media.name}". Verifique o formato ou tente novamente.`);
    }
  };

  // Transcreve um áudio individual sob demanda (ou analisa se for foto/vídeo)
  const handleTranscribeSingle = async (audio: ExtractedAudioFile) => {
    if (audio.mediaType === 'image' || audio.mediaType === 'video') {
      return handleAnalyzeSingleMedia(audio);
    }

    // Verifica cota disponível
    if (!billingState.isPremium && billingState.freeTrialAudiosUsed >= billingState.freeTrialAudiosTotal) {
      setIsPricingModalOpen(true);
      return;
    }

    setErrorMessage(null);
    audio.status = 'transcribing';
    audio.errorMessage = undefined;
    setAudiosList((prev) => prev.map((a) => (a.name === audio.name ? { ...a, status: 'transcribing' } : a)));

    try {
      const result = await transcribeSingleAudio(audio);
      audio.transcription = result.transcription;
      audio.modelUsed = result.modelUsed;
      if (result.speakersDetected) {
        audio.speakersDetected = result.speakersDetected;
        audio.hasMultipleSpeakers = result.hasMultipleSpeakers;
      }
      audio.status = 'completed';

      consumeFreeTrialQuota();
      setBillingState(getStoredBilling());

      setAudiosList((prev) =>
        prev.map((a) => (a.name === audio.name ? { ...audio, status: 'completed' } : a))
      );

      setParsedChat((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.audioFile?.name === audio.name
              ? { ...m, audioFile: { ...audio, status: 'completed' } }
              : m
          ),
        };
      });
    } catch (err: any) {
      const errMsg = err.message || 'Erro na transcrição';
      audio.status = 'error';
      audio.errorMessage = errMsg;
      setAudiosList((prev) =>
        prev.map((a) => (a.name === audio.name ? { ...a, status: 'error', errorMessage: errMsg } : a))
      );
      setParsedChat((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.audioFile?.name === audio.name ? { ...m, audioFile: { ...audio, status: 'error', errorMessage: errMsg } } : m
          ),
        };
      });
      setErrorMessage(`Não foi possível transcrever "${audio.name}". O sistema tentou os modelos gemini-3.5-transcribe e gemini-3.1-flash-lite.`);
    }
  };

  // Atualiza observação/contexto e flag de múltiplos interlocutores de um áudio
  const handleUpdateAudioNotes = (audioName: string, notes: string, hasMultipleSpeakers?: boolean) => {
    setAudiosList((prev) =>
      prev.map((a) =>
        a.name === audioName
          ? {
              ...a,
              userNotes: notes,
              hasMultipleSpeakers: hasMultipleSpeakers !== undefined ? hasMultipleSpeakers : a.hasMultipleSpeakers,
            }
          : a
      )
    );
    setParsedChat((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        messages: prev.messages.map((m) =>
          m.audioFile?.name === audioName
            ? {
                ...m,
                audioFile: {
                  ...m.audioFile,
                  userNotes: notes,
                  hasMultipleSpeakers: hasMultipleSpeakers !== undefined ? hasMultipleSpeakers : m.audioFile.hasMultipleSpeakers,
                },
              }
            : m
        ),
      };
    });
  };

  // Renomeia o rótulo de um interlocutor identificado em toda a transcrição
  const handleRenameSpeaker = (audioName: string, oldSpeaker: string, newSpeaker: string) => {
    const trimmed = newSpeaker.trim();
    if (!trimmed || oldSpeaker === trimmed) return;

    setAudiosList((prev) =>
      prev.map((a) => {
        if (a.name !== audioName || !a.transcription) return a;
        const updatedTranscript = a.transcription
          .split(`[${oldSpeaker}]:`).join(`[${trimmed}]:`)
          .split(`${oldSpeaker}:`).join(`${trimmed}:`);
        const updatedSpeakers = (a.speakersDetected || []).map((s) => (s === oldSpeaker ? trimmed : s));
        return {
          ...a,
          transcription: updatedTranscript,
          speakersDetected: updatedSpeakers,
        };
      })
    );

    setParsedChat((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        messages: prev.messages.map((m) => {
          if (m.audioFile?.name !== audioName || !m.audioFile.transcription) return m;
          const updatedTranscript = m.audioFile.transcription
            .split(`[${oldSpeaker}]:`).join(`[${trimmed}]:`)
            .split(`${oldSpeaker}:`).join(`${trimmed}:`);
          const updatedSpeakers = (m.audioFile.speakersDetected || []).map((s) => (s === oldSpeaker ? trimmed : s));
          return {
            ...m,
            audioFile: {
              ...m.audioFile,
              transcription: updatedTranscript,
              speakersDetected: updatedSpeakers,
            },
          };
        }),
      };
    });
  };

  // Atualiza diretamente o texto transcrito revisado manualmente pelo usuário
  const handleUpdateTranscriptionText = (audioName: string, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed) return;

    setAudiosList((prev) =>
      prev.map((a) => (a.name === audioName ? { ...a, transcription: trimmed } : a))
    );

    setParsedChat((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        messages: prev.messages.map((m) =>
          m.audioFile?.name === audioName
            ? {
                ...m,
                audioFile: {
                  ...m.audioFile,
                  transcription: trimmed,
                },
              }
            : m
        ),
      };
    });
  };

  // Reinicia e retenta áudios que falharam na transcrição
  const handleRetryFailedAudios = () => {
    setErrorMessage(null);
    setAudiosList((prev) =>
      prev.map((a) => (a.status === 'error' ? { ...a, status: 'idle', errorMessage: undefined } : a))
    );
    setParsedChat((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        messages: prev.messages.map((m) =>
          m.audioFile?.status === 'error'
            ? { ...m, audioFile: { ...m.audioFile, status: 'idle', errorMessage: undefined } }
            : m
        ),
      };
    });
    setTimeout(() => {
      handleStartTranscription();
    }, 50);
  };

  // Gera o conteúdo do arquivo TXT consolidado
  const currentTxtContent = parsedChat ? generateUnifiedTxt(parsedChat, zipName) : '';
  const transcribedAudioCount = audiosList.filter((a) => a.status === 'completed').length;
  const isCurrentZipUnlocked = billingState.isPremium || billingState.unlockedZipNames.includes(zipName);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navbar */}
      <Navbar
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoggingIn={isLoggingIn}
        zipLoadedName={zipName}
        billingState={billingState}
        onOpenPricing={() => setIsPricingModalOpen(true)}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-8 space-y-6">
        {/* Banner de Alerta Amigável com Botão de Tentar Novamente */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-amber-500/30 text-zinc-200 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="font-semibold text-zinc-100">{errorMessage}</p>
                <p className="text-zinc-400 text-xs mt-0.5">
                  A esteira tentou o modelo dedicado gemini-3.5-transcribe com fallback para gemini-3.1-flash-lite.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {audiosList.some((a) => a.status === 'error') && !isTranscribing && (
                <button
                  onClick={handleRetryFailedAudios}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all flex items-center gap-1.5 shadow"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tentar novamente</span>
                </button>
              )}
              <button
                onClick={() => setErrorMessage(null)}
                className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 rounded-xl transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {/* State 1: No file loaded */}
        {!parsedChat ? (
          <div className="space-y-8 py-4">
            {/* Hero Banner */}
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>IA Multimodal · Cota de Testes Gratuita</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight">
                Transcreva Áudios e Conversas de Qualquer Plataforma
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Conecte-se ao Google Drive, importe arquivos do WhatsApp ou Telegram,
                grave áudios ao vivo pelo microfone ou arraste qualquer gravação para transcrever com precisão instantânea.
              </p>

              {/* Botão de Divulgação / Impulsionamento para Amigos e Google */}
              <div className="pt-1 flex items-center justify-center gap-2">
                <button
                  onClick={shareAppOnWhatsApp}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[11px] text-zinc-300 transition-colors"
                  title="Compartilhar aplicativo no WhatsApp"
                >
                  <span>📢 Compartilhar app no WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Universal Multi-Platform Hub */}
            <div className="max-w-4xl mx-auto">
              <PlatformHub
                onFilesSelected={handleFilesSelected}
                onOpenDriveModal={() => setIsDriveModalOpen(true)}
                onOpenRecorderModal={() => setIsRecorderModalOpen(true)}
                onOpenDePara={() => setIsDeParaModalOpen(true)}
                onLoadDemo={handleLoadDemo}
                onOpenPricing={() => setIsPricingModalOpen(true)}
                billingState={billingState}
                isProcessing={isProcessingZip}
                statusMessage={zipStatusMessage}
              />
            </div>
          </div>
        ) : (
          /* State 2: Files Loaded, Workspace View */
          <div className="space-y-6">
            {/* Top Workspace Header Bar */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <FileArchive className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-zinc-100 font-mono">
                      {zipName}
                    </h2>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      Carregado
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 mt-1">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{parsedChat.messages.length} mensagens no histórico</span>
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1.5">
                      <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        {audiosList.length} áudios ({transcribedAudioCount} transcritos)
                      </span>
                    </span>
                    {parsedChat.participants.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{parsedChat.participants.join(', ')}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setIsRecorderModalOpen(true)}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-rose-300 border border-rose-500/20 rounded-xl text-xs font-medium transition-colors flex items-center gap-2"
                >
                  <Mic className="w-3.5 h-3.5 text-rose-400" />
                  <span>Gravar Áudio</span>
                </button>

                <button
                  onClick={() => setIsDeParaModalOpen(true)}
                  className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2"
                  title="Vincular arquivo TXT do WhatsApp para sincronizar horários e identificar quem enviou cada áudio"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>De-Para (TXT WhatsApp)</span>
                </button>

                <button
                  onClick={() => setIsDriveModalOpen(true)}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium transition-colors flex items-center gap-2"
                >
                  <Cloud className="w-3.5 h-3.5 text-blue-400" />
                  <span>Do Google Drive</span>
                </button>

                <button
                  onClick={() => {
                    setParsedChat(null);
                    setRawZip(null);
                    setAudiosList([]);
                    setZipName('');
                  }}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors flex items-center gap-2"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Novo Arquivo</span>
                </button>

                <button
                  onClick={() => setIsTxtModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-2 active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar (TXT/JSON/CSV)</span>
                </button>
              </div>
            </div>

            {/* Tab Selection */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 ${
                    activeTab === 'chat'
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span>Linha do Tempo Completa do Chat</span>
                </button>

                <button
                  onClick={() => setActiveTab('queue')}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 ${
                    activeTab === 'queue'
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Headphones className="w-4 h-4 text-emerald-400" />
                  <span>Fila de Transcrição ({transcribedAudioCount}/{audiosList.length})</span>
                </button>
              </div>

              {/* Transcribe All CTA */}
              {transcribedAudioCount < audiosList.length && (
                <button
                  onClick={handleStartTranscription}
                  disabled={isTranscribing}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isTranscribing ? 'Transcrevendo áudios...' : 'Transcrever todos com Gemini'}
                  </span>
                </button>
              )}
            </div>

            {/* Tab Content */}
            {activeTab === 'chat' ? (
              <ChatViewer
                messages={parsedChat.messages}
                participants={parsedChat.participants}
                isPremium={isCurrentZipUnlocked}
                onOpenPricing={() => setIsPricingModalOpen(true)}
                onOpenDePara={() => setIsDeParaModalOpen(true)}
                onTranscribeSingle={handleTranscribeSingle}
                onAnalyzeMediaSingle={handleAnalyzeSingleMedia}
                onUpdateAudioNotes={handleUpdateAudioNotes}
                onRenameSpeaker={handleRenameSpeaker}
                onUpdateTranscriptionText={handleUpdateTranscriptionText}
              />
            ) : (
              <TranscriptionQueue
                audios={audiosList}
                isTranscribing={isTranscribing}
                progress={queueProgress}
                onStartAll={handleStartTranscription}
                onPause={handlePauseTranscription}
                onTranscribeSingle={handleTranscribeSingle}
                onUpdateAudioNotes={handleUpdateAudioNotes}
                onRenameSpeaker={handleRenameSpeaker}
                isPremium={isCurrentZipUnlocked}
                onOpenPricing={() => setIsPricingModalOpen(true)}
              />
            )}
          </div>
        )}
      </main>

      {/* Google Drive Browser Modal */}
      <DriveModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        token={token}
        onLogin={handleLogin}
        onFileDownloaded={(buffer, name) => processZipData(buffer, name)}
      />

      {/* Modal de Gravação Direta do Microfone */}
      <AudioRecorderModal
        isOpen={isRecorderModalOpen}
        onClose={() => setIsRecorderModalOpen(false)}
        onAudioRecorded={handleAudioRecorded}
      />

      {/* Modal de De-Para de Horários e Remetentes do WhatsApp */}
      <DeParaModal
        isOpen={isDeParaModalOpen}
        onClose={() => setIsDeParaModalOpen(false)}
        audiosList={audiosList}
        onApplyDePara={handleApplyDePara}
      />

      {/* Confirmação de De-Para antes de iniciar a Transcrição */}
      {showDeParaConfirmBeforeTranscribe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">
                  Vincular TXT da Conversa Antes da Transcrição?
                </h3>
                <p className="text-xs text-zinc-400">
                  Garante o pareamento exato das horas e identifica quem enviou cada áudio
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/70 p-4 rounded-2xl border border-zinc-800">
              Você carregou arquivos de áudio sem o arquivo <strong>TXT da conversa do WhatsApp</strong>. Ao vincular o TXT antes de transcrever, a IA cruza o horário de envio do áudio com a mensagem (De-Para), identifica os participantes e formula um <strong>histórico TXT completo e ordenado</strong> sem se perder nas horas.
            </p>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-1">
              <button
                onClick={() => {
                  setShowDeParaConfirmBeforeTranscribe(false);
                  executeTranscriptionActual();
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors text-center"
              >
                Transcrever Direto Sem TXT
              </button>
              <button
                onClick={() => {
                  setShowDeParaConfirmBeforeTranscribe(false);
                  setIsDeParaModalOpen(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-all flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span>Vincular TXT da Conversa (Recomendado)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Preview & Download Modal */}
      <TxtExportModal
        isOpen={isTxtModalOpen}
        onClose={() => setIsTxtModalOpen(false)}
        txtContent={currentTxtContent}
        parsedChat={parsedChat}
        sourceName={zipName}
      />

      {/* Modal de Planos e Cota de Testes */}
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        billingState={billingState}
        onBillingUpdated={(newState) => setBillingState(newState)}
        activeZipName={zipName}
      />

      {/* Barra de Navegação Inferior para Celular (Mobile First) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenRecorder={() => setIsRecorderModalOpen(true)}
        onOpenExport={() => setIsTxtModalOpen(true)}
        onOpenPricing={() => setIsPricingModalOpen(true)}
        hasLoadedChat={Boolean(parsedChat)}
        billingState={billingState}
      />
    </div>
  );
}
