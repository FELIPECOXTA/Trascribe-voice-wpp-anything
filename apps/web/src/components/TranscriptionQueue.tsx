import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Pause,
  Headphones,
  FileAudio,
  Image as ImageIcon,
  Video as VideoIcon,
  Eye,
  FileText,
  Tag,
  X,
  Users,
} from 'lucide-react';
import { ExtractedAudioFile } from '../services/zipParser';
import { QueueProgress } from '../services/transcriber';

interface TranscriptionQueueProps {
  audios: ExtractedAudioFile[];
  isTranscribing: boolean;
  progress: QueueProgress | null;
  onStartAll: () => void;
  onPause: () => void;
  onTranscribeSingle: (audio: ExtractedAudioFile) => void;
  onUpdateAudioNotes?: (audioName: string, notes: string, hasMultipleSpeakers?: boolean) => void;
  onRenameSpeaker?: (audioName: string, oldSpeaker: string, newSpeaker: string) => void;
  isPremium?: boolean;
  onOpenPricing?: () => void;
}

export const TranscriptionQueue: React.FC<TranscriptionQueueProps> = ({
  audios,
  isTranscribing,
  progress,
  onStartAll,
  onPause,
  onTranscribeSingle,
  onUpdateAudioNotes,
  onRenameSpeaker,
  isPremium = false,
  onOpenPricing,
}) => {
  const [activeNotesAudio, setActiveNotesAudio] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [multipleSpeakersDraft, setMultipleSpeakersDraft] = useState(false);
  const completedCount = audios.filter((a) => a.status === 'completed').length;
  const errorCount = audios.filter((a) => a.status === 'error').length;
  const pendingCount = audios.filter((a) => a.status === 'idle').length;
  const activeCount = audios.filter((a) => a.status === 'transcribing').length;

  const percent = audios.length > 0 ? Math.round((completedCount / audios.length) * 100) : 0;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getMediaLabel = (media: ExtractedAudioFile) => {
    if (media.mediaType === 'image') return 'Foto / Imagem';
    if (media.mediaType === 'video') return 'Vídeo';
    return 'Áudio';
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100 sm:text-base">
              Fila de Transcrição & Análise Multimodal
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
              {completedCount}/{audios.length} concluídos
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Transcreva áudios e analise fotos e vídeos com IA multimodal (Gemini 3.5 e 3.8).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {errorCount > 0 && !isTranscribing && (
            <button
              onClick={() => {
                audios.forEach((a) => {
                  if (a.status === 'error') a.status = 'idle';
                });
                onStartAll();
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar novamente ({errorCount})</span>
            </button>
          )}

          {isTranscribing ? (
            <button
              onClick={onPause}
              className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-medium transition-colors flex items-center gap-2"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pausar Fila</span>
            </button>
          ) : (
            <button
              onClick={onStartAll}
              disabled={audios.length === 0 || completedCount === audios.length}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white disabled:text-zinc-500 rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-2 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {completedCount === audios.length && audios.length > 0
                  ? 'Todos os Arquivos Processados'
                  : 'Processar Todos com IA'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Friendly Alert Banner when errors occur */}
      {errorCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/30 text-xs space-y-2">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-100">
                  {errorCount === 1
                    ? '1 arquivo não pôde ser processado no momento'
                    : `${errorCount} arquivos não puderam ser processados no momento`}
                </p>
                <p className="text-zinc-300 mt-0.5 leading-relaxed">
                  A esteira tentou os modelos multimodais de alta precisão. Seus arquivos continuam salvos na lista para você tentar novamente quando desejar.
                </p>
              </div>
            </div>
            {!isTranscribing && (
              <button
                onClick={() => {
                  audios.forEach((a) => {
                    if (a.status === 'error') a.status = 'idle';
                  });
                  onStartAll();
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shrink-0 self-end sm:self-auto shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar novamente agora</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-zinc-400 font-mono">
          <span>Progresso geral: {percent}%</span>
          <div className="flex items-center gap-3">
            <span>Pendentes: {pendingCount}</span>
            {activeCount > 0 && <span className="text-emerald-400">Em andamento: {activeCount}</span>}
            {errorCount > 0 && <span className="text-rose-400">Falhas: {errorCount}</span>}
          </div>
        </div>
        <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Media Items List */}
      <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
        {audios.map((item) => {
          const isCurrent = item.status === 'transcribing';
          const isDone = item.status === 'completed';
          const isErr = item.status === 'error';
          const isImg = item.mediaType === 'image';
          const isVid = item.mediaType === 'video';

          return (
            <div
              key={item.name}
              className={`p-3.5 rounded-xl border transition-all ${
                isCurrent
                  ? 'bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20'
                  : isDone
                  ? 'bg-zinc-950/60 border-zinc-800/80'
                  : isErr
                  ? 'bg-rose-950/20 border-rose-500/30'
                  : 'bg-zinc-950/40 border-zinc-800/60'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* File info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isDone
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : isCurrent
                        ? 'bg-emerald-500/20 text-emerald-300 animate-pulse'
                        : isErr
                        ? 'bg-rose-500/10 text-rose-400'
                        : isImg
                        ? 'bg-amber-500/10 text-amber-400'
                        : isVid
                        ? 'bg-sky-500/10 text-sky-400'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {isCurrent ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isDone ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : isErr ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : isImg ? (
                      <ImageIcon className="w-4 h-4" />
                    ) : isVid ? (
                      <VideoIcon className="w-4 h-4" />
                    ) : (
                      <FileAudio className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-zinc-200 truncate font-mono">
                        {item.name}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                        {getMediaLabel(item)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 mt-0.5 font-mono">
                      <span>{formatFileSize(item.size)}</span>
                      <span>·</span>
                      <span>{item.mimeType}</span>
                      {item.durationSeconds !== undefined && item.durationSeconds > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-400 font-mono">
                            {item.durationSeconds}s de duração
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline Player/Thumbnail & Single action */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Media Preview */}
                  {isImg ? (
                    <img
                      src={item.objectUrl}
                      alt={item.name}
                      className="w-9 h-9 object-cover rounded-lg border border-zinc-700/80 bg-zinc-950 shrink-0"
                    />
                  ) : isVid ? (
                    <video
                      src={item.objectUrl}
                      className="h-8 max-w-[140px] rounded-lg bg-black"
                      controls
                    />
                  ) : (
                    <audio
                      controls
                      src={item.objectUrl}
                      className="h-8 max-w-[180px] sm:max-w-[220px] opacity-90"
                      preload="metadata"
                    />
                  )}

                  {/* Botão de Observação / 2+ Pessoas para Áudio */}
                  {!isImg && !isVid && (
                    <button
                      onClick={() => {
                        if (activeNotesAudio === item.name) {
                          setActiveNotesAudio(null);
                        } else {
                          setActiveNotesAudio(item.name);
                          setNotesDraft(item.userNotes || '');
                          setMultipleSpeakersDraft(Boolean(item.hasMultipleSpeakers));
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 border ${
                        item.userNotes
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700/60'
                      }`}
                      title="Colocar observação sobre o áudio e marcar se há 2 ou mais pessoas"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">{item.userNotes ? 'Editar Nota' : '+ Nota / 2+ Pessoas'}</span>
                    </button>
                  )}

                  {/* Individual Action */}
                  {!isDone && !isCurrent && (
                    <button
                      onClick={() => onTranscribeSingle(item)}
                      disabled={isTranscribing}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>{isImg ? 'Ler Foto' : isVid ? 'Analisar Vídeo' : 'Transcrever'}</span>
                    </button>
                  )}

                  {isErr && (
                    <button
                      onClick={() => onTranscribeSingle(item)}
                      className="px-2.5 py-1.5 bg-rose-900/40 hover:bg-rose-800/60 text-rose-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Tentar Novamente</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Observação Existente (quando fechado) */}
              {item.userNotes && activeNotesAudio !== item.name && (
                <div className="mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <Tag className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate italic">Nota: "{item.userNotes}"</span>
                    {item.hasMultipleSpeakers && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 shrink-0">
                        2+ pessoas
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setActiveNotesAudio(item.name);
                      setNotesDraft(item.userNotes || '');
                      setMultipleSpeakersDraft(Boolean(item.hasMultipleSpeakers));
                    }}
                    className="text-[10px] text-amber-300 hover:underline shrink-0"
                  >
                    Editar
                  </button>
                </div>
              )}

              {/* Editor Inline de Observação na Fila */}
              {activeNotesAudio === item.name && (
                <div className="mt-3 p-3.5 rounded-xl bg-zinc-950 border border-amber-500/40 space-y-2.5 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-100 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      Observação / 2 ou mais pessoas neste áudio:
                    </span>
                    <button onClick={() => setActiveNotesAudio(null)} className="text-zinc-500 hover:text-zinc-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={multipleSpeakersDraft}
                      onChange={(e) => setMultipleSpeakersDraft(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-zinc-700 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-zinc-300 text-xs font-semibold">
                      Gravação com 2 ou mais pessoas (reconhecer e rotular quem está falando)
                    </span>
                  </label>

                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={2}
                    placeholder="Adicione observações ou nomes dos participantes (ex: conversa entre João e Maria)..."
                    className="w-full p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-amber-500"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setActiveNotesAudio(null)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        if (onUpdateAudioNotes) {
                          onUpdateAudioNotes(item.name, notesDraft, multipleSpeakersDraft);
                        }
                        setActiveNotesAudio(null);
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                    >
                      Salvar Nota
                    </button>
                  </div>
                </div>
              )}

              {/* Analysis / Transcription Result Box */}
              {isDone && (item.transcription || item.analysis) && (
                <div className="mt-3 pt-2.5 border-t border-zinc-800/80 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-400 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      <span>Processamento Concluído com Sucesso:</span>
                    </div>
                    {item.modelUsed && (
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {item.modelUsed}
                      </span>
                    )}
                  </div>

                  {item.analysis && (
                    <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-zinc-200 text-xs leading-relaxed space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block font-mono">
                        🔍 Leitura OCR & Análise Visual:
                      </span>
                      <p className="whitespace-pre-line">{item.analysis}</p>
                    </div>
                  )}

                  {item.transcription && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-zinc-200 text-xs leading-relaxed space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 font-mono">
                          🗣️ Transcrição do Áudio / Fala:
                        </span>
                        {item.speakersDetected && item.speakersDetected.length > 1 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold">
                            👥 {item.speakersDetected.length} oradores: {item.speakersDetected.join(', ')}
                          </span>
                        )}
                      </div>
                      <p className="italic whitespace-pre-wrap">"{item.transcription}"</p>
                    </div>
                  )}
                </div>
              )}

              {/* Error Details */}
              {isErr && item.errorMessage && (
                <div className="mt-2 text-xs text-rose-400 pl-2 border-l-2 border-rose-500">
                  {item.errorMessage}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
