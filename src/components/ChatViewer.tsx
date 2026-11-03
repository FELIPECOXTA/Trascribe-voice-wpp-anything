import React, { useState, useMemo } from 'react';
import {
  Search,
  Mic,
  MessageSquare,
  Users,
  Sparkles,
  Volume2,
  Copy,
  Check,
  Share2,
  Type,
  Clock,
  Image as ImageIcon,
  Video as VideoIcon,
  LayoutGrid,
  Maximize2,
  X,
  Eye,
  SlidersHorizontal,
  Download,
  FileText,
  Pencil,
  Tag,
  CheckCircle2,
  RotateCcw,
  UserCheck,
} from 'lucide-react';
import { ChatMessage } from '../services/chatParser';
import { ExtractedAudioFile } from '../services/zipParser';
import { parseSpeakerTurns, SpeakerTurn } from '../services/transcriber';
import { ChatStatsPanel } from './ChatStatsPanel';
import { shareTranscript } from '../services/shareHelper';

interface ChatViewerProps {
  messages: ChatMessage[];
  participants: string[];
  isPremium?: boolean;
  onOpenPricing?: () => void;
  onOpenDePara?: () => void;
  onTranscribeSingle?: (audio: ExtractedAudioFile) => void;
  onAnalyzeMediaSingle?: (media: ExtractedAudioFile) => void;
  onUpdateAudioNotes?: (audioName: string, notes: string, hasMultipleSpeakers?: boolean) => void;
  onRenameSpeaker?: (audioName: string, oldSpeaker: string, newSpeaker: string) => void;
  onUpdateTranscriptionText?: (audioName: string, newText: string) => void;
}

// Gera cor determinística e vibrante para o avatar do remetente
const SENDER_COLORS = [
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/30' },
  { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
  { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/30' },
  { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/30' },
  { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/30' },
];

function getSenderColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SENDER_COLORS.length;
  return SENDER_COLORS[index];
}

function getSenderInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Renderiza o texto da transcrição destacando trechos com incerteza ou ruído para revisão humana
 */
function renderHighlightedTranscript(text: string, isLargeFont: boolean) {
  // Captura [trecho inaudível], [trecho incerto: ...], [inaudível]
  const pattern = /(\[(?:trecho\s+)?(?:inaudível|inaudivel|incerto:[^\]]+)\])/gi;
  const parts = text.split(pattern);

  return (
    <span className={`leading-relaxed select-text ${isLargeFont ? 'text-base sm:text-lg font-medium' : 'text-sm sm:text-base'}`}>
      {parts.map((part, i) => {
        if (/^\[(?:trecho\s+)?(?:inaudível|inaudivel|incerto:[^\]]+)\]$/i.test(part.trim())) {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold cursor-help"
              title="Trecho que requer revisão ou escuta atenta"
            >
              ⚠️ {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export const ChatViewer: React.FC<ChatViewerProps> = ({
  messages,
  participants,
  isPremium = false,
  onOpenPricing,
  onOpenDePara,
  onTranscribeSingle,
  onAnalyzeMediaSingle,
  onUpdateAudioNotes,
  onRenameSpeaker,
  onUpdateTranscriptionText,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'audios' | 'media' | 'text'>('all');
  const [selectedParticipant, setSelectedParticipant] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [isLargeFont, setIsLargeFont] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'bubbles'>('cards');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  // Observações do Áudio (Editor inline por áudio)
  const [activeNotesAudio, setActiveNotesAudio] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>('');
  const [multipleSpeakersDraft, setMultipleSpeakersDraft] = useState<boolean>(false);

  // Modal para renomear interlocutor
  const [renamingSpeaker, setRenamingSpeaker] = useState<{
    audioName: string;
    currentSpeaker: string;
  } | null>(null);
  const [newSpeakerDraft, setNewSpeakerDraft] = useState('');

  // Modal para Revisão / Edição Direta da Transcrição
  const [editingTranscriptAudio, setEditingTranscriptAudio] = useState<{
    audioName: string;
    sender: string;
    timestamp: string;
    objectUrl?: string;
    initialText: string;
  } | null>(null);
  const [editedTranscriptDraft, setEditedTranscriptDraft] = useState('');

  // Modo de exibição da transcrição (diálogo vs contínuo) por áudio
  const [dialogueViewMap, setDialogueViewMap] = useState<Record<string, boolean>>({});

  // Modal Lightbox para visualização de imagem em tamanho real
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    name: string;
    sender: string;
    timestamp: string;
  } | null>(null);

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      // Filtro por tipo
      if (filterType === 'audios' && !msg.isAudio) return false;
      if (filterType === 'media' && !msg.isImage && !msg.isVideo) return false;
      if (filterType === 'text' && (msg.isAudio || msg.isImage || msg.isVideo)) return false;

      // Filtro por participante
      if (selectedParticipant !== 'all' && msg.sender !== selectedParticipant) {
        return false;
      }

      // Filtro por termo de busca
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const inContent = msg.content.toLowerCase().includes(query);
        const inSender = msg.sender.toLowerCase().includes(query);
        const inTranscript = msg.audioFile?.transcription?.toLowerCase().includes(query);
        const inAnalysis = msg.audioFile?.analysis?.toLowerCase().includes(query);
        if (!inContent && !inSender && !inTranscript && !inAnalysis) return false;
      }

      return true;
    });
  }, [messages, filterType, selectedParticipant, searchQuery]);

  const audiosCount = useMemo(() => messages.filter((m) => m.isAudio).length, [messages]);
  const mediaCount = useMemo(() => messages.filter((m) => m.isImage || m.isVideo).length, [messages]);
  const textCount = useMemo(() => messages.filter((m) => !m.isAudio && !m.isImage && !m.isVideo).length, [messages]);

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareText = async (id: string, sender: string, text: string, type: string = 'Áudio') => {
    const formatted = `*${type} de ${sender}:*\n"${text}"\n\n_Processado via Transcreva Tudo AI_`;
    await shareTranscript(formatted);
    setSharedId(id);
    setTimeout(() => setSharedId(null), 2000);
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl overflow-hidden flex flex-col min-h-[700px] shadow-xl">
      {/* Painel de Estatísticas no Topo */}
      <ChatStatsPanel
        messages={messages}
        participants={participants}
        selectedParticipant={selectedParticipant}
        onSelectParticipant={(p) => setSelectedParticipant(p)}
      />

      {/* Toolbar Principal com Filtros, Layout e Acessibilidade */}
      <div className="p-3.5 sm:p-5 border-b border-zinc-800 bg-zinc-950/60 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Segmented Filter Buttons (Todas, Áudios, Fotos/Vídeos, Texto) */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-2xl border border-zinc-800 overflow-x-auto max-w-full shadow-inner">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap min-h-[36px] ${
                filterType === 'all'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Todas ({messages.length})
            </button>
            <button
              onClick={() => setFilterType('audios')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap min-h-[36px] ${
                filterType === 'audios'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Áudios ({audiosCount})</span>
            </button>
            {mediaCount > 0 && (
              <button
                onClick={() => setFilterType('media')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap min-h-[36px] ${
                  filterType === 'media'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Fotos & Vídeos ({mediaCount})</span>
              </button>
            )}
            <button
              onClick={() => setFilterType('text')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap min-h-[36px] ${
                filterType === 'text'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Texto ({textCount})</span>
            </button>
          </div>

          {/* Controles de Layout (Cards vs Bolhas, Densidade e Letra Grande) */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Toggle: Visualização em Card vs Bolhas */}
            <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'cards'
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Visualização em Cards estruturados com alta legibilidade"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                onClick={() => setViewMode('bubbles')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'bubbles'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Modo tradicional de bolhas de chat"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bolhas</span>
              </button>
            </div>

            {/* Densidade de Espaçamento */}
            <button
              onClick={() => setDensity(density === 'comfortable' ? 'compact' : 'comfortable')}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[36px] ${
                density === 'compact'
                  ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
              title="Ajustar densidade de espaçamento dos cards"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{density === 'compact' ? 'Compacto' : 'Espaçoso'}</span>
            </button>

            {/* Acessibilidade: Letra Grande */}
            <button
              onClick={() => setIsLargeFont(!isLargeFont)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[36px] ${
                isLargeFont
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
              title="Aumentar tamanho da letra para facilitar a leitura no celular"
            >
              <Type className="w-3.5 h-3.5" />
              <span>{isLargeFont ? 'Letra Normal' : 'Aumentar Letra'}</span>
            </button>

            {/* Botão de De-Para WhatsApp com Horários */}
            {onOpenDePara && (
              <button
                onClick={onOpenDePara}
                className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[36px]"
                title="Vincular arquivo TXT de conversa para identificar quem enviou cada áudio ou mídia pelos horários exatos"
              >
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">De-Para Horários</span>
                <span className="sm:hidden">De-Para</span>
              </button>
            )}

            {/* Participant Filter Dropdown */}
            {participants.length > 0 && (
              <select
                value={selectedParticipant}
                onChange={(e) => setSelectedParticipant(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 min-h-[36px]"
              >
                <option value="all">Todos ({participants.length})</option>
                {participants.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Barra de Pesquisa */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por palavras no chat, áudios transcritos ou análises de fotos e vídeos..."
            className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Banner Informativo: De-Para Conectado ou Pendente */}
      {messages.some((m) => !m.isAudio && !m.isSystem && !m.isImage && !m.isVideo) ? (
        <div className="px-4 py-2.5 bg-emerald-950/20 border-b border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-400">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="text-zinc-300 text-[11px] sm:text-xs">
              <strong className="text-emerald-400 font-semibold">De-Para Ativo:</strong> Mensagens, áudios, fotos e vídeos sincronizados com as horas reais da conversa do WhatsApp.
            </span>
          </div>
          {onOpenDePara && (
            <button
              onClick={onOpenDePara}
              className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-2 ml-auto"
            >
              Reaplicar / Atualizar TXT
            </button>
          )}
        </div>
      ) : (
        <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-300">
            <Clock className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="text-zinc-200 text-xs">
              <strong className="text-amber-300 font-bold">Arquivo TXT da conversa não vinculado:</strong> Para a IA fazer o De-Para da hora das mensagens com os áudios e fotos, identificar quem mandou cada um e formular o TXT completo sem perder as horas, vincule o arquivo TXT do WhatsApp!
            </span>
          </div>
          {onOpenDePara && (
            <button
              onClick={onOpenDePara}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-black hover:bg-amber-400 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Vincular TXT da Conversa (De-Para)</span>
            </button>
          )}
        </div>
      )}

      {/* Messages Timeline Feed */}
      <div
        className={`flex-1 overflow-y-auto p-3.5 sm:p-6 ${
          density === 'compact' ? 'space-y-3' : 'space-y-4 sm:space-y-5'
        }`}
      >
        {filteredMessages.length === 0 ? (
          <div className="py-20 text-center text-zinc-500 space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-xs">Nenhuma mensagem encontrada com os filtros selecionados.</p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            // Mensagem do sistema
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="text-center my-3">
                  <div className="inline-block px-4 py-1.5 bg-zinc-900 border border-zinc-800/80 rounded-xl text-[11px] text-zinc-400 max-w-lg leading-relaxed shadow-sm">
                    {msg.timestamp && (
                      <span className="font-mono text-zinc-500 mr-1.5 font-semibold">{msg.timestamp} ·</span>
                    )}
                    <span>{msg.content}</span>
                  </div>
                </div>
              );
            }

            const media = msg.audioFile;
            const isAudio = msg.isAudio;
            const isImage = msg.isImage;
            const isVideo = msg.isVideo;
            const senderColor = getSenderColor(msg.sender);
            const initials = getSenderInitials(msg.sender);

            // -------------------------------------------------------------
            // LAYOUT 1: VISUALIZAÇÃO EM CARD (Mobile-First, Alta Legibilidade)
            // -------------------------------------------------------------
            if (viewMode === 'cards') {
              return (
                <div
                  key={msg.id}
                  className={`w-full rounded-2xl sm:rounded-3xl transition-all shadow-md ${
                    density === 'compact' ? 'p-3.5 sm:p-4 space-y-2.5' : 'p-4 sm:p-5 space-y-3.5'
                  } ${
                    isAudio
                      ? 'bg-zinc-900/95 border border-emerald-500/30 hover:border-emerald-500/50'
                      : isImage
                      ? 'bg-zinc-900/95 border border-sky-500/30 hover:border-sky-500/50'
                      : isVideo
                      ? 'bg-zinc-900/95 border border-purple-500/30 hover:border-purple-500/50'
                      : 'bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700/80'
                  }`}
                >
                  {/* Card Header: Remetente + Badges + Timestamp Destacado para Mobile */}
                  <div className="flex items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar do Participante com iniciais */}
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 border ${senderColor.bg} ${senderColor.text} ${senderColor.border} shadow-inner`}
                      >
                        {initials}
                      </div>

                      <div className="min-w-0">
                        {/* Nome do Remetente - Perfeitamente Legível no Celular */}
                        <h4
                          className={`font-bold tracking-tight text-zinc-100 truncate ${
                            isLargeFont ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
                          }`}
                        >
                          {msg.sender}
                        </h4>

                        {/* Badges de Tipo & De-Para */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {isAudio && (
                            <span className="text-[10px] sm:text-[11px] text-emerald-400 font-semibold flex items-center gap-1 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              <Volume2 className="w-3 h-3" />
                              <span>Áudio</span>
                            </span>
                          )}
                          {isImage && (
                            <span className="text-[10px] sm:text-[11px] text-sky-400 font-semibold flex items-center gap-1 font-mono bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                              <ImageIcon className="w-3 h-3" />
                              <span>Foto / Imagem</span>
                            </span>
                          )}
                          {isVideo && (
                            <span className="text-[10px] sm:text-[11px] text-purple-400 font-semibold flex items-center gap-1 font-mono bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                              <VideoIcon className="w-3 h-3" />
                              <span>Vídeo</span>
                            </span>
                          )}
                          {!isAudio && !isImage && !isVideo && (
                            <span className="text-[10px] sm:text-[11px] text-zinc-400 font-semibold flex items-center gap-1 font-mono bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/60">
                              <MessageSquare className="w-3 h-3" />
                              <span>Texto</span>
                            </span>
                          )}

                          {msg.matchedByTimestamp && (
                            <span
                              className="text-[10px] sm:text-[11px] text-teal-300 font-semibold flex items-center gap-1 font-mono bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20"
                              title={media?.matchedReason || 'Horário e remetente sincronizados com a conversa'}
                            >
                              <Clock className="w-3 h-3" />
                              <span className="hidden sm:inline">Horário Sincronizado</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Timestamp: Chip de Alta Legibilidade e Contraste para Celular */}
                    <div className="shrink-0 text-right">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/90 border border-zinc-700/80 text-zinc-100 font-mono text-xs font-bold shadow-sm">
                        <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>{msg.timestamp || 'Horário não informado'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Body por Tipo de Mídia */}

                  {/* 1. MENSAGEM DE ÁUDIO */}
                  {isAudio && (
                    <div className="space-y-3 pt-1">
                      {/* Player de Áudio & Ações Rápidas */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800">
                        <div className="flex items-center gap-2 text-xs font-mono text-zinc-300 truncate">
                          <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="truncate font-medium">{msg.audioFileName || media?.name || 'audio.opus'}</span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {media?.objectUrl && (
                            <audio
                              controls
                              src={media.objectUrl}
                              className="h-9 w-full sm:max-w-[240px] opacity-95"
                              preload="metadata"
                            />
                          )}

                          {/* Botão de Adicionar/Editar Observação do Áudio */}
                          <button
                            onClick={() => {
                              if (media) {
                                if (activeNotesAudio === media.name) {
                                  setActiveNotesAudio(null);
                                } else {
                                  setActiveNotesAudio(media.name);
                                  setNotesDraft(media.userNotes || '');
                                  setMultipleSpeakersDraft(Boolean(media.hasMultipleSpeakers));
                                }
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border min-h-[36px] ${
                              media?.userNotes
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700/60'
                            }`}
                            title="Colocar observação sobre o áudio e identificar se contém 2 ou mais pessoas"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            <span>{media?.userNotes ? 'Editar Observação' : '+ Observação / 2+ Pessoas'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Card de Observação Existente (quando o editor inline não está ativo) */}
                      {media?.userNotes && activeNotesAudio !== media.name && (
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 text-xs">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 text-amber-400 font-bold">
                              <Tag className="w-3.5 h-3.5" />
                              <span>Observação sobre este áudio:</span>
                              {media.hasMultipleSpeakers && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 font-mono">
                                  👥 2+ Pessoas
                                </span>
                              )}
                            </div>
                            <p className="text-zinc-200 leading-relaxed font-medium italic">
                              "{media.userNotes}"
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setActiveNotesAudio(media.name);
                              setNotesDraft(media.userNotes || '');
                              setMultipleSpeakersDraft(Boolean(media.hasMultipleSpeakers));
                            }}
                            className="p-1.5 text-zinc-400 hover:text-amber-300 rounded-lg hover:bg-amber-500/20 transition-colors shrink-0"
                            title="Editar observação"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Painel Expansível de Edição de Observação do Áudio */}
                      {media && activeNotesAudio === media.name && (
                        <div className="p-4 rounded-2xl bg-zinc-950 border border-amber-500/40 space-y-3 animate-in fade-in duration-150 shadow-xl">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <h5 className="text-xs font-bold text-zinc-100">
                                Observação do Áudio & Reconhecimento de Quem Está Falando
                              </h5>
                            </div>
                            <button
                              onClick={() => setActiveNotesAudio(null)}
                              className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            Informe se este áudio é uma gravação de 2 ou mais pessoas ou adicione notas contextuais (como nomes dos participantes). A IA utilizará isso para identificar quem está falando com máxima precisão.
                          </p>

                          {/* Checkbox 2 ou mais pessoas */}
                          <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
                            <input
                              type="checkbox"
                              checked={multipleSpeakersDraft}
                              onChange={(e) => setMultipleSpeakersDraft(e.target.checked)}
                              className="w-4 h-4 rounded border-zinc-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-zinc-900"
                            />
                            <div className="text-xs">
                              <span className="font-bold text-zinc-200">
                                Gravação de 2 ou mais pessoas (Ativar reconhecimento de interlocutores)
                              </span>
                              <p className="text-[11px] text-zinc-400">
                                A IA separará cada fala identificando a troca de voz (ex: [Interlocutor 1], [Interlocutor 2] ou nomes informados).
                              </p>
                            </div>
                          </label>

                          {/* Campo de Texto para a Observação */}
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-zinc-300">
                              Sua Observação ou Nomes dos Participantes:
                            </label>
                            <textarea
                              value={notesDraft}
                              onChange={(e) => setNotesDraft(e.target.value)}
                              rows={2}
                              placeholder="Ex: Gravação de 2 pessoas entre Dr. Marcos e paciente Ana sobre orçamento..."
                              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          {/* Sugestões Rápidas de Observação */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-zinc-500 font-mono">Sugestões rápidas:</span>
                            {[
                              'Gravação de 2 pessoas conversando',
                              'Entrevista / Perguntas e Respostas',
                              'Reunião com 3 ou mais vozes',
                              'Chamada telefônica gravada',
                            ].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  setNotesDraft(preset);
                                  setMultipleSpeakersDraft(true);
                                }}
                                className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 border border-zinc-700/60 transition-colors"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>

                          {/* Botões de Salvar */}
                          <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                            <button
                              onClick={() => setActiveNotesAudio(null)}
                              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                            >
                              Cancelar
                            </button>

                            <button
                              onClick={() => {
                                if (onUpdateAudioNotes) {
                                  onUpdateAudioNotes(media.name, notesDraft, multipleSpeakersDraft);
                                }
                                setActiveNotesAudio(null);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                              <span>Salvar Observação</span>
                            </button>

                            {onTranscribeSingle && (
                              <button
                                onClick={() => {
                                  if (onUpdateAudioNotes) {
                                    onUpdateAudioNotes(media.name, notesDraft, multipleSpeakersDraft);
                                  }
                                  setActiveNotesAudio(null);
                                  setTimeout(() => {
                                    onTranscribeSingle({
                                      ...media,
                                      userNotes: notesDraft,
                                      hasMultipleSpeakers: multipleSpeakersDraft,
                                    });
                                  }, 50);
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-all flex items-center gap-1.5"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>{media.transcription ? 'Salvar e Re-transcrever com IA' : 'Salvar e Transcrever'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Caixa de Transcrição Fonética Profunda & Reconhecimento de Interlocutores */}
                      {media?.transcription ? (
                        <div className="bg-emerald-950/25 border border-emerald-500/30 rounded-2xl p-4 space-y-3.5 shadow-inner">
                          {/* Header da Transcrição */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold tracking-wide">
                              <Sparkles className="w-4 h-4 text-emerald-400" />
                              <span>Transcrição com Reconhecimento de Vozes</span>
                              {media.durationSeconds !== undefined && media.durationSeconds > 0 && (
                                <span className="text-[11px] text-zinc-400 font-mono font-medium">
                                  ({media.durationSeconds}s)
                                </span>
                              )}
                              {media.modelUsed && (
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono hidden sm:inline">
                                  {media.modelUsed}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Alternar Visão: Diálogo vs Texto Corrido se houver múltiplos turnos */}
                              {(() => {
                                const turns = parseSpeakerTurns(media.transcription);
                                const hasTurns = turns.length > 1;
                                const isDialogueView = dialogueViewMap[media.name] !== false;
                                if (!hasTurns) return null;
                                return (
                                  <button
                                    onClick={() =>
                                      setDialogueViewMap((prev) => ({
                                        ...prev,
                                        [media.name]: !isDialogueView,
                                      }))
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold border border-zinc-700/60 transition-colors flex items-center gap-1"
                                    title="Alternar entre balões de diálogo e texto corrido"
                                  >
                                    <MessageSquare className="w-3 h-3 text-emerald-400" />
                                    <span>{isDialogueView ? 'Ver Texto Corrido' : 'Ver em Diálogo'}</span>
                                  </button>
                                );
                              })()}

                                {/* Botão de Revisão da Transcrição / Edição de Palavras */}
                                {onUpdateTranscriptionText && (
                                  <button
                                    onClick={() => {
                                      setEditingTranscriptAudio({
                                        audioName: media.name,
                                        sender: msg.sender,
                                        timestamp: msg.timestamp,
                                        objectUrl: media.objectUrl,
                                        initialText: media.transcription!,
                                      });
                                      setEditedTranscriptDraft(media.transcription!);
                                    }}
                                    className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 min-h-[32px]"
                                    title="Revisar e corrigir palavras da transcrição ou ajustar trechos inaudíveis"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Revisar Texto</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => handleShareText(msg.id, msg.sender, media.transcription!, 'Áudio')}
                                  className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 min-h-[32px]"
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                  <span>{sharedId === msg.id ? 'Copiado p/ Envio!' : 'Enviar no WhatsApp'}</span>
                                </button>

                                <button
                                  onClick={() => handleCopyText(msg.id, media.transcription!)}
                                  className="p-2 text-zinc-300 hover:text-emerald-400 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center border border-zinc-700/60"
                                  title="Copiar transcrição completa"
                                >
                                  {copiedId === msg.id ? (
                                    <Check className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                            </div>
                          </div>

                          {/* Seção de Interlocutores Identificados (Quem está falando) */}
                          {(() => {
                            const turns = parseSpeakerTurns(media.transcription);
                            const distinctSpeakers = Array.from(new Set(turns.map((t) => t.speaker))).filter(
                              (s) => s !== 'Voz Principal'
                            );
                            const speakersList = media.speakersDetected && media.speakersDetected.length > 0
                              ? media.speakersDetected
                              : distinctSpeakers;

                            if (speakersList.length === 0) return null;

                            return (
                              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                                  <span className="text-xs font-bold text-zinc-200">
                                    Quem está falando ({speakersList.length} vozes identificadas):
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {speakersList.map((speaker) => {
                                    const col = getSenderColor(speaker);
                                    return (
                                      <div
                                        key={speaker}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${col.bg} ${col.text} ${col.border}`}
                                      >
                                        <span>{speaker}</span>
                                        {onRenameSpeaker && (
                                          <button
                                            onClick={() => {
                                              setRenamingSpeaker({
                                                audioName: media.name,
                                                currentSpeaker: speaker,
                                              });
                                              setNewSpeakerDraft(speaker);
                                            }}
                                            className="p-0.5 hover:bg-black/30 rounded text-zinc-300 hover:text-white transition-colors"
                                            title={`Renomear "${speaker}" para o nome real`}
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Renderização do Conteúdo Transcrito: Diálogo Separado por Voz vs Texto Corrido */}
                          {(() => {
                            const turns = parseSpeakerTurns(media.transcription);
                            const hasMultipleSpeakers = turns.length > 1;
                            const isDialogueView = dialogueViewMap[media.name] !== false;

                            if (hasMultipleSpeakers && isDialogueView) {
                              return (
                                <div className="space-y-2.5 pt-1">
                                  {turns.map((turn, idx) => {
                                    const col = getSenderColor(turn.speaker);
                                    return (
                                      <div
                                        key={idx}
                                        className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1.5 hover:border-zinc-700 transition-all"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2">
                                            <div
                                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${col.bg} ${col.text} border ${col.border}`}
                                            >
                                              {getSenderInitials(turn.speaker)}
                                            </div>
                                            <span className={`text-xs font-bold ${col.text}`}>
                                              {turn.speaker}
                                            </span>
                                            {onRenameSpeaker && (
                                              <button
                                                onClick={() => {
                                                  setRenamingSpeaker({
                                                    audioName: media.name,
                                                    currentSpeaker: turn.speaker,
                                                  });
                                                  setNewSpeakerDraft(turn.speaker);
                                                }}
                                                className="text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-0.5"
                                                title="Renomear este interlocutor"
                                              >
                                                <Pencil className="w-2.5 h-2.5" />
                                                <span className="hidden sm:inline">renomear</span>
                                              </button>
                                            )}
                                          </div>

                                          <button
                                            onClick={() => handleCopyText(`turn-${msg.id}-${idx}`, turn.text)}
                                            className="text-zinc-400 hover:text-emerald-400 p-1 rounded-md"
                                            title="Copiar apenas esta fala"
                                          >
                                            {copiedId === `turn-${msg.id}-${idx}` ? (
                                              <Check className="w-3 h-3 text-emerald-400" />
                                            ) : (
                                              <Copy className="w-3 h-3" />
                                            )}
                                          </button>
                                        </div>

                                        <div
                                          className={`text-zinc-100 leading-relaxed pl-8 select-text ${
                                            isLargeFont ? 'text-base font-medium' : 'text-xs sm:text-sm'
                                          }`}
                                        >
                                          {renderHighlightedTranscript(turn.text, isLargeFont)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            }

                            // Exibição em Texto Corrido
                            return (
                              <div
                                className={`text-zinc-100 leading-relaxed whitespace-pre-wrap select-text ${
                                  isLargeFont ? 'text-base sm:text-lg font-medium' : 'text-sm sm:text-base'
                                }`}
                              >
                                {renderHighlightedTranscript(media.transcription, isLargeFont)}
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 gap-3">
                          <div className="flex items-center gap-2.5 text-xs text-zinc-400">
                            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                            <span>
                              {media?.status === 'transcribing'
                                ? 'Transcrevendo áudio e identificando interlocutores...'
                                : media?.status === 'error'
                                ? `Erro na transcrição: ${media.errorMessage || 'Falha'}`
                                : media?.userNotes
                                ? `Áudio com observação anexada. Pronto para transcrever!`
                                : 'Áudio carregado. Você pode colocar uma observação antes de transcrever.'}
                            </span>
                          </div>
                          {onTranscribeSingle && media && media.status !== 'transcribing' && (
                            <button
                              onClick={() => onTranscribeSingle(media)}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition-all flex items-center justify-center gap-1.5 shrink-0"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Transcrever Agora</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. MENSAGEM DE FOTO / IMAGEM */}
                  {isImage && (
                    <div className="space-y-3 pt-1">
                      {/* Visualizador da Imagem */}
                      {media?.objectUrl ? (
                        <div className="relative group max-w-sm rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800/90 shadow-md">
                          <img
                            src={media.objectUrl}
                            alt={msg.content || 'Foto enviada no WhatsApp'}
                            className="max-h-72 w-full object-contain cursor-pointer hover:scale-[1.01] transition-transform duration-200"
                            onClick={() =>
                              setLightboxImage({
                                url: media.objectUrl,
                                name: media.name,
                                sender: msg.sender,
                                timestamp: msg.timestamp,
                              })
                            }
                          />
                          <button
                            onClick={() =>
                              setLightboxImage({
                                url: media.objectUrl,
                                name: media.name,
                                sender: msg.sender,
                                timestamp: msg.timestamp,
                              })
                            }
                            className="absolute bottom-2.5 right-2.5 p-2 bg-black/70 hover:bg-black/90 text-white rounded-xl backdrop-blur-md transition-all shadow"
                            title="Expandir foto em tamanho real"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-zinc-950/80 rounded-2xl border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-sky-400" />
                          <span>{msg.content}</span>
                        </div>
                      )}

                      {/* Caixa de Análise Visual & OCR da Foto */}
                      {media?.analysis ? (
                        <div className="bg-sky-950/25 border border-sky-500/30 rounded-2xl p-4 space-y-3 shadow-inner">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 text-xs text-sky-400 font-bold tracking-wide">
                              <Eye className="w-4 h-4 text-sky-400" />
                              <span>Leitura de Texto (OCR) & Análise Visual da Foto</span>
                              {media.modelUsed && (
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-300 font-mono hidden sm:inline">
                                  {media.modelUsed}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleShareText(msg.id, msg.sender, media.analysis!, 'Foto/OCR')}
                                className="px-3 py-1.5 bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 min-h-[32px]"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>{sharedId === msg.id ? 'Copiado!' : 'Enviar no WhatsApp'}</span>
                              </button>

                              <button
                                onClick={() => handleCopyText(msg.id, media.analysis!)}
                                className="p-2 text-zinc-300 hover:text-sky-400 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center border border-zinc-700/60"
                                title="Copiar análise da foto"
                              >
                                {copiedId === msg.id ? (
                                  <Check className="w-4 h-4 text-sky-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <p
                            className={`text-zinc-100 leading-relaxed whitespace-pre-wrap select-text ${
                              isLargeFont ? 'text-base sm:text-lg font-medium' : 'text-sm sm:text-base'
                            }`}
                          >
                            {media.analysis}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 gap-3">
                          <div className="flex items-center gap-2.5 text-xs text-zinc-400">
                            <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
                            <span>
                              {media?.status === 'transcribing'
                                ? 'Lendo comprovantes, textos e analisando a cena da foto...'
                                : media?.status === 'error'
                                ? `Erro na análise: ${media.errorMessage || 'Falha'}`
                                : 'Foto carregada. A IA pode ler todos os textos (OCR) e descrever o conteúdo.'}
                            </span>
                          </div>
                          {onAnalyzeMediaSingle && media && media.status !== 'transcribing' && (
                            <button
                              onClick={() => onAnalyzeMediaSingle(media)}
                              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-1.5 shrink-0"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Analisar Foto com IA</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. MENSAGEM DE VÍDEO */}
                  {isVideo && (
                    <div className="space-y-3 pt-1">
                      {/* Player de Vídeo */}
                      {media?.objectUrl ? (
                        <div className="rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-md max-w-lg">
                          <video
                            controls
                            src={media.objectUrl}
                            className="w-full max-h-80 object-contain bg-black"
                            preload="metadata"
                          />
                        </div>
                      ) : (
                        <div className="p-3 bg-zinc-950/80 rounded-2xl border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
                          <VideoIcon className="w-4 h-4 text-purple-400" />
                          <span>{msg.content}</span>
                        </div>
                      )}

                      {/* Caixa de Transcrição e Análise Visual do Vídeo */}
                      {media?.analysis || media?.transcription ? (
                        <div className="bg-purple-950/25 border border-purple-500/30 rounded-2xl p-4 space-y-3 shadow-inner">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 text-xs text-purple-400 font-bold tracking-wide">
                              <VideoIcon className="w-4 h-4 text-purple-400" />
                              <span>Transcrição de Falas & Análise Visual do Vídeo</span>
                              {media.modelUsed && (
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono hidden sm:inline">
                                  {media.modelUsed}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleShareText(msg.id, msg.sender, (media.analysis || media.transcription)!, 'Vídeo')}
                                className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 min-h-[32px]"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>{sharedId === msg.id ? 'Copiado!' : 'Enviar no WhatsApp'}</span>
                              </button>

                              <button
                                onClick={() => handleCopyText(msg.id, (media.analysis || media.transcription)!)}
                                className="p-2 text-zinc-300 hover:text-purple-400 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center border border-zinc-700/60"
                                title="Copiar análise do vídeo"
                              >
                                {copiedId === msg.id ? (
                                  <Check className="w-4 h-4 text-purple-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <p
                            className={`text-zinc-100 leading-relaxed whitespace-pre-wrap select-text ${
                              isLargeFont ? 'text-base sm:text-lg font-medium' : 'text-sm sm:text-base'
                            }`}
                          >
                            {media.analysis || media.transcription}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 gap-3">
                          <div className="flex items-center gap-2.5 text-xs text-zinc-400">
                            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                            <span>
                              {media?.status === 'transcribing'
                                ? 'Analisando o vídeo e transcrevendo as falas com a IA...'
                                : media?.status === 'error'
                                ? `Erro na análise: ${media.errorMessage || 'Falha'}`
                                : 'Vídeo carregado. A IA pode transcrever as falas e descrever o que acontece na cena.'}
                            </span>
                          </div>
                          {onAnalyzeMediaSingle && media && media.status !== 'transcribing' && (
                            <button
                              onClick={() => onAnalyzeMediaSingle(media)}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-1.5 shrink-0"
                            >
                              <VideoIcon className="w-3.5 h-3.5" />
                              <span>Analisar Vídeo com IA</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. MENSAGEM DE TEXTO TRADICIONAL */}
                  {!isAudio && !isImage && !isVideo && (
                    <div className="flex items-start justify-between gap-3 pt-1">
                      <p
                        className={`text-zinc-200 leading-relaxed whitespace-pre-wrap select-text flex-1 ${
                          isLargeFont ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'
                        }`}
                      >
                        {msg.content}
                      </p>
                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors shrink-0"
                        title="Copiar texto da mensagem"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            // -------------------------------------------------------------
            // LAYOUT 2: MODO BOLHAS TRADICIONAL DO WHATSAPP
            // -------------------------------------------------------------
            return (
              <div
                key={msg.id}
                className={`w-full sm:max-w-2xl rounded-2xl p-4 space-y-2.5 transition-all ${
                  isAudio
                    ? 'bg-zinc-900/95 border border-emerald-500/40 shadow-lg'
                    : isImage
                    ? 'bg-zinc-900/95 border border-sky-500/40 shadow-lg'
                    : isVideo
                    ? 'bg-zinc-900/95 border border-purple-500/40 shadow-lg'
                    : 'bg-zinc-900/60 border border-zinc-800/80'
                }`}
              >
                {/* Header: Sender and Timestamp */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold ${
                        isAudio
                          ? 'text-emerald-400'
                          : isImage
                          ? 'text-sky-400'
                          : isVideo
                          ? 'text-purple-400'
                          : 'text-zinc-200'
                      } ${isLargeFont ? 'text-sm' : 'text-xs'}`}
                    >
                      {msg.sender}
                    </span>
                    {isAudio && (
                      <span className="text-[10px] text-emerald-400/90 flex items-center gap-1 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <Volume2 className="w-3 h-3" />
                        <span>Áudio</span>
                      </span>
                    )}
                    {isImage && (
                      <span className="text-[10px] text-sky-400/90 flex items-center gap-1 font-mono bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                        <ImageIcon className="w-3 h-3" />
                        <span>Foto</span>
                      </span>
                    )}
                    {isVideo && (
                      <span className="text-[10px] text-purple-400/90 flex items-center gap-1 font-mono bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                        <VideoIcon className="w-3 h-3" />
                        <span>Vídeo</span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-300 font-mono font-semibold shrink-0 bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-700/60">
                    {msg.timestamp}
                  </span>
                </div>

                {/* Content */}
                {isAudio ? (
                  <div className="space-y-3 pt-0.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800">
                      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 truncate">
                        <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{msg.audioFileName || media?.name || 'audio.opus'}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {media?.objectUrl && (
                          <audio
                            controls
                            src={media.objectUrl}
                            className="h-9 w-full sm:max-w-[240px] opacity-95"
                            preload="metadata"
                          />
                        )}
                        <button
                          onClick={() => {
                            if (media) {
                              if (activeNotesAudio === media.name) {
                                setActiveNotesAudio(null);
                              } else {
                                setActiveNotesAudio(media.name);
                                setNotesDraft(media.userNotes || '');
                                setMultipleSpeakersDraft(Boolean(media.hasMultipleSpeakers));
                              }
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 border ${
                            media?.userNotes
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700/60'
                          }`}
                        >
                          <FileText className="w-3 h-3 text-amber-400" />
                          <span>{media?.userNotes ? 'Ver Observação' : '+ Observação'}</span>
                        </button>
                      </div>
                    </div>

                    {media?.userNotes && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                        <span className="font-bold">📝 Observação: </span>
                        <span>"{media.userNotes}"</span>
                      </div>
                    )}

                    {media?.transcription && (
                      <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-3.5 space-y-2.5 relative group shadow-sm">
                        {(() => {
                          const turns = parseSpeakerTurns(media.transcription);
                          if (turns.length > 1) {
                            return (
                              <div className="space-y-2">
                                {turns.map((t, i) => {
                                  const col = getSenderColor(t.speaker);
                                  return (
                                    <div key={i} className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className={`font-bold ${col.text}`}>{t.speaker}:</span>
                                      </div>
                                      <div className="text-zinc-100 pl-2">
                                        {renderHighlightedTranscript(t.text, isLargeFont)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          return (
                            <div
                              className={`text-zinc-100 leading-relaxed whitespace-pre-wrap select-text ${
                                isLargeFont ? 'text-base sm:text-lg font-medium' : 'text-xs sm:text-sm'
                              }`}
                            >
                              {renderHighlightedTranscript(media.transcription, isLargeFont)}
                            </div>
                          );
                        })()}

                        {/* Ações rápidas na bolha */}
                        {onUpdateTranscriptionText && (
                          <div className="pt-1 flex items-center justify-end gap-2 border-t border-emerald-500/10">
                            <button
                              onClick={() => {
                                setEditingTranscriptAudio({
                                  audioName: media.name,
                                  sender: msg.sender,
                                  timestamp: msg.timestamp,
                                  objectUrl: media.objectUrl,
                                  initialText: media.transcription!,
                                });
                                setEditedTranscriptDraft(media.transcription!);
                              }}
                              className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 font-semibold"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Revisar / Corrigir</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : isImage ? (
                  <div className="space-y-2">
                    {media?.objectUrl && (
                      <img
                        src={media.objectUrl}
                        alt="Foto"
                        className="max-h-60 rounded-xl object-contain bg-zinc-950 border border-zinc-800"
                      />
                    )}
                    {media?.analysis && (
                      <p className="text-xs text-zinc-200 bg-sky-950/30 p-2.5 rounded-xl border border-sky-500/30">
                        {media.analysis}
                      </p>
                    )}
                  </div>
                ) : isVideo ? (
                  <div className="space-y-2">
                    {media?.objectUrl && (
                      <video
                        controls
                        src={media.objectUrl}
                        className="max-h-60 rounded-xl bg-black border border-zinc-800"
                      />
                    )}
                    {(media?.analysis || media?.transcription) && (
                      <p className="text-xs text-zinc-200 bg-purple-950/30 p-2.5 rounded-xl border border-purple-500/30">
                        {media.analysis || media.transcription}
                      </p>
                    )}
                  </div>
                ) : (
                  <p
                    className={`text-zinc-300 leading-relaxed whitespace-pre-wrap ${
                      isLargeFont ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'
                    }`}
                  >
                    {msg.content}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Lightbox Modal para Fotos em Tamanho Real */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header com remetente, timestamp e fechar */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800 text-xs">
              <div>
                <h4 className="font-bold text-zinc-100 text-sm">{lightboxImage.sender}</h4>
                <span className="text-zinc-400 font-mono text-[11px]">{lightboxImage.timestamp}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxImage.url}
                  download={lightboxImage.name}
                  className="p-2 text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  title="Baixar imagem"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Baixar</span>
                </a>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Imagem em tamanho amplo */}
            <div className="pt-4 flex-1 flex items-center justify-center overflow-auto max-h-[70vh]">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.name}
                className="max-h-[68vh] max-w-full object-contain rounded-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal para Renomear Interlocutor / Quem está falando */}
      {renamingSpeaker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setRenamingSpeaker(null)}
        >
          <div
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-100">
                    Identificar / Renomear Interlocutor
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Substitui o rótulo atual em toda a transcrição deste áudio
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRenamingSpeaker(null)}
                className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-xl hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Nome Real do Orador para <span className="text-emerald-400 font-mono">[{renamingSpeaker.currentSpeaker}]</span>:
              </label>
              <input
                type="text"
                value={newSpeakerDraft}
                onChange={(e) => setNewSpeakerDraft(e.target.value)}
                placeholder="Ex: Dr. Marcos, Felipe, Mariana, Cliente..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (onRenameSpeaker && newSpeakerDraft.trim()) {
                      onRenameSpeaker(renamingSpeaker.audioName, renamingSpeaker.currentSpeaker, newSpeakerDraft.trim());
                      setRenamingSpeaker(null);
                    }
                  }
                }}
                className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Sugestões de nomes dos participantes da conversa se existirem */}
            {participants.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] text-zinc-400 font-medium">Usar nome de participante:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {participants.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewSpeakerDraft(p)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 border border-zinc-700/60 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setRenamingSpeaker(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (onRenameSpeaker && newSpeakerDraft.trim()) {
                    onRenameSpeaker(renamingSpeaker.audioName, renamingSpeaker.currentSpeaker, newSpeakerDraft.trim());
                    setRenamingSpeaker(null);
                  }
                }}
                disabled={!newSpeakerDraft.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Nome</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Revisão & Edição de Transcrição Humana */}
      {editingTranscriptAudio && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setEditingTranscriptAudio(null)}
        >
          <div
            className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <span>Revisão & Edição de Transcrição</span>
                    <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                      Fidelidade Acústica
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Áudio de <strong className="text-zinc-200">{editingTranscriptAudio.sender}</strong> ({editingTranscriptAudio.timestamp})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingTranscriptAudio(null)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Player do Áudio Original para audição simultânea */}
              {editingTranscriptAudio.objectUrl && (
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <span className="font-semibold flex items-center gap-1.5 text-emerald-400">
                      <Volume2 className="w-4 h-4" />
                      <span>Ouvir Gravação Original:</span>
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono truncate max-w-[200px]">
                      {editingTranscriptAudio.audioName}
                    </span>
                  </div>
                  <audio
                    controls
                    src={editingTranscriptAudio.objectUrl}
                    className="w-full h-9 rounded-xl"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Dica: Ouça com fones para verificar termos com ruído de fundo ou sobreposição de vozes.
                  </p>
                </div>
              )}

              {/* Botões de Inserção Rápida de Tags de Incerteza e Diarização */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-zinc-300">Inserir tags de precisão:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: '+ [trecho inaudível]', tag: ' [trecho inaudível] ' },
                    { label: '+ [trecho incerto]', tag: ' [trecho incerto: ...] ' },
                    { label: '+ [Interlocutor 1]:', tag: '\n[Interlocutor 1]: ' },
                    { label: '+ [Interlocutor 2]:', tag: '\n[Interlocutor 2]: ' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setEditedTranscriptDraft((prev) => prev + item.tag)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-amber-300 border border-amber-500/20 transition-colors font-mono"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea de Edição */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Texto Transcrito (Edição Livre):</span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {editedTranscriptDraft.length} caracteres
                  </span>
                </label>
                <textarea
                  value={editedTranscriptDraft}
                  onChange={(e) => setEditedTranscriptDraft(e.target.value)}
                  rows={8}
                  className="w-full p-3.5 rounded-2xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 leading-relaxed font-sans select-text"
                  placeholder="Edite as palavras da transcrição..."
                />
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
                <strong className="text-zinc-200">Integridade da Consulta:</strong> A transcrição revisada será utilizada em tempo real nos cards e na exportação unificada do WhatsApp TXT.
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setEditedTranscriptDraft(editingTranscriptAudio.initialText)}
                className="px-3.5 py-2 text-xs text-zinc-400 hover:text-zinc-200 underline"
              >
                Restaurar Transcrição Inicial
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTranscriptAudio(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateTranscriptionText && editedTranscriptDraft.trim()) {
                      onUpdateTranscriptionText(editingTranscriptAudio.audioName, editedTranscriptDraft.trim());
                    }
                    setEditingTranscriptAudio(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Revisão</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
