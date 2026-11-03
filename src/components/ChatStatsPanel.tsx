import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Users,
  Calendar,
  Headphones,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  FileAudio,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { ChatMessage } from '../services/chatParser';

interface ChatStatsPanelProps {
  messages: ChatMessage[];
  participants: string[];
  onSelectParticipant?: (participant: string) => void;
  selectedParticipant?: string;
}

interface ParticipantStats {
  name: string;
  total: number;
  textCount: number;
  audioCount: number;
  audioBytes: number;
  percent: number;
}

/**
 * Extrai a data no formato YYYY-MM-DD ou DD/MM/YYYY para agregação
 */
function extractDateKey(timestamp: string): string | null {
  if (!timestamp) return null;
  // Procura padrão DD/MM/YYYY ou DD/MM/YY
  const match = timestamp.match(/(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
  if (match) {
    const [, d, m, y] = match;
    const fullYear = y.length === 2 ? `20${y}` : y;
    const padD = d.padStart(2, '0');
    const padM = m.padStart(2, '0');
    return `${fullYear}-${padM}-${padD}`;
  }
  return null;
}

export const ChatStatsPanel: React.FC<ChatStatsPanelProps> = ({
  messages,
  participants,
  onSelectParticipant,
  selectedParticipant = 'all',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const stats = useMemo(() => {
    const nonSystemMessages = messages.filter((m) => !m.isSystem && m.sender && m.sender !== 'Sistema');
    const totalMsgs = nonSystemMessages.length;

    // 1. Estatísticas por participante
    const participantMap = new Map<string, ParticipantStats>();

    for (const msg of nonSystemMessages) {
      const p = msg.sender;
      if (!participantMap.has(p)) {
        participantMap.set(p, {
          name: p,
          total: 0,
          textCount: 0,
          audioCount: 0,
          audioBytes: 0,
          percent: 0,
        });
      }
      const pStat = participantMap.get(p)!;
      pStat.total++;
      if (msg.isAudio) {
        pStat.audioCount++;
        if (msg.audioFile?.size) {
          pStat.audioBytes += msg.audioFile.size;
        }
      } else {
        pStat.textCount++;
      }
    }

    const participantList = Array.from(participantMap.values()).map((p) => ({
      ...p,
      percent: totalMsgs > 0 ? Math.round((p.total / totalMsgs) * 100) : 0,
    })).sort((a, b) => b.total - a.total);

    // 2. Média de mensagens por dia & Dias ativos
    const dateCountMap = new Map<string, number>();
    for (const msg of messages) {
      const dateKey = extractDateKey(msg.timestamp);
      if (dateKey) {
        dateCountMap.set(dateKey, (dateCountMap.get(dateKey) || 0) + 1);
      }
    }

    const uniqueDays = dateCountMap.size;
    const sortedDates = Array.from(dateCountMap.keys()).sort();
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];

    let avgPerDay = 0;
    if (uniqueDays > 0) {
      avgPerDay = Math.round((totalMsgs / uniqueDays) * 10) / 10;
    } else {
      avgPerDay = totalMsgs;
    }

    // Dia de maior pico
    let peakDay = '';
    let peakCount = 0;
    for (const [day, count] of dateCountMap.entries()) {
      if (count > peakCount) {
        peakCount = count;
        peakDay = day;
      }
    }

    const formatDayDisplay = (isoDate: string) => {
      if (!isoDate) return '';
      const parts = isoDate.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return isoDate;
    };

    // 3. Volume total de áudio enviado
    const audioMessages = messages.filter((m) => m.isAudio);
    const totalAudioCount = audioMessages.length;
    const totalAudioBytes = audioMessages.reduce(
      (acc, m) => acc + (m.audioFile?.size || 0),
      0
    );
    const audioPercentage = totalMsgs > 0 ? Math.round((totalAudioCount / totalMsgs) * 100) : 0;
    const transcribedAudioCount = audioMessages.filter((m) => m.audioFile?.transcription).length;

    return {
      totalMsgs,
      participantList,
      uniqueDays,
      avgPerDay,
      firstDateDisplay: formatDayDisplay(firstDate),
      lastDateDisplay: formatDayDisplay(lastDate),
      peakDayDisplay: formatDayDisplay(peakDay),
      peakCount,
      totalAudioCount,
      totalAudioBytes,
      audioPercentage,
      transcribedAudioCount,
    };
  }, [messages]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border-b border-zinc-800 bg-zinc-950/70 transition-all">
      {/* Header bar / Toggle */}
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-zinc-200">Painel de Estatísticas da Conversa</span>
          <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
            · {stats.totalMsgs} mensagens · {stats.totalAudioCount} áudios · {stats.uniqueDays} {stats.uniqueDays === 1 ? 'dia ativo' : 'dias ativos'}
          </span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-zinc-800/60 transition-colors"
          title={isExpanded ? 'Recolher métricas' : 'Expandir métricas'}
        >
          <span>{isExpanded ? 'Recolher' : 'Ver Métricas'}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Expanded Stats Body */}
      {isExpanded && (
        <div className="p-4 pt-1 space-y-4">
          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: Média Diária & Período */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Média de Mensagens</span>
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {stats.uniqueDays} {stats.uniqueDays === 1 ? 'dia' : 'dias'}
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold font-mono text-zinc-100">
                    {stats.avgPerDay}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">msgs / dia ativo</span>
                </div>

                <div className="mt-2 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400 space-y-0.5">
                  {stats.firstDateDisplay && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Período:</span>
                      <span className="font-mono text-zinc-300">
                        {stats.firstDateDisplay} {stats.lastDateDisplay && stats.lastDateDisplay !== stats.firstDateDisplay ? `a ${stats.lastDateDisplay}` : ''}
                      </span>
                    </div>
                  )}
                  {stats.peakDayDisplay && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Dia de pico:</span>
                      <span className="font-mono text-emerald-400">
                        {stats.peakDayDisplay} ({stats.peakCount} msgs)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Volume Total de Áudio */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Volume Total de Áudios</span>
                </span>
                <span className="font-mono text-[11px] text-emerald-400">
                  {stats.audioPercentage}% do chat
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-zinc-100">
                    {stats.totalAudioCount}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">
                    arquivos ({formatBytes(stats.totalAudioBytes)})
                  </span>
                </div>

                <div className="mt-2 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400 space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Status de transcrição:</span>
                    <span className="font-mono text-zinc-300">
                      {stats.transcribedAudioCount} de {stats.totalAudioCount} transcritos
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Taxa áudio / texto:</span>
                    <span className="font-mono text-zinc-300">
                      1 áudio a cada {stats.totalAudioCount > 0 ? Math.round((stats.totalMsgs - stats.totalAudioCount) / stats.totalAudioCount) : 0} textos
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Participantes Ativos */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Participantes</span>
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {stats.participantList.length} identificados
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold font-mono text-zinc-100">
                    {stats.participantList.length}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">pessoas no grupo/chat</span>
                </div>

                <div className="mt-2 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400 space-y-0.5">
                  {stats.participantList[0] && (
                    <div className="flex justify-between truncate">
                      <span className="text-zinc-500">Mais ativo:</span>
                      <span className="font-mono text-zinc-200 truncate ml-2">
                        {stats.participantList[0].name} ({stats.participantList[0].total} msgs)
                      </span>
                    </div>
                  )}
                  {stats.participantList.find((p) => p.audioCount > 0) && (
                    <div className="flex justify-between truncate">
                      <span className="text-zinc-500">Mais áudios:</span>
                      <span className="font-mono text-emerald-400 truncate ml-2">
                        {[...stats.participantList].sort((a, b) => b.audioCount - a.audioCount)[0]?.name} (
                        {[...stats.participantList].sort((a, b) => b.audioCount - a.audioCount)[0]?.audioCount} áudios)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown por participante com barras de distribuição */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300">
                Distribuição e Volume de Mensagens por Participante
              </span>
              <span className="text-[11px] text-zinc-500">
                Clique no participante para filtrar a conversa
              </span>
            </div>

            <div className="space-y-2.5">
              {stats.participantList.map((p) => {
                const isSelected = selectedParticipant === p.name;
                return (
                  <div
                    key={p.name}
                    onClick={() => onSelectParticipant && onSelectParticipant(isSelected ? 'all' : p.name)}
                    className={`p-2 rounded-lg transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/30'
                        : 'bg-zinc-950/40 border-zinc-800/50 hover:bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-zinc-200 truncate">
                          {p.name}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] text-emerald-400 font-mono">
                            (Filtrado)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 shrink-0">
                        <span>{p.total} msgs</span>
                        <span>·</span>
                        <span className="text-emerald-400">{p.audioCount} áudios ({formatBytes(p.audioBytes)})</span>
                        <span>·</span>
                        <span>{p.textCount} textos</span>
                        <span>·</span>
                        <span className="text-zinc-200 font-bold">{p.percent}%</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden flex">
                      {/* Audio portion */}
                      <div
                        className="bg-emerald-500 h-full"
                        style={{
                          width: `${stats.totalMsgs > 0 ? (p.audioCount / stats.totalMsgs) * 100 : 0}%`,
                        }}
                        title={`Áudios: ${p.audioCount}`}
                      />
                      {/* Text portion */}
                      <div
                        className="bg-zinc-600 h-full"
                        style={{
                          width: `${stats.totalMsgs > 0 ? (p.textCount / stats.totalMsgs) * 100 : 0}%`,
                        }}
                        title={`Textos: ${p.textCount}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
