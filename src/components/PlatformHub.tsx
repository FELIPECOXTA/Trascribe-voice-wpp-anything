import React, { useRef, useState } from 'react';
import {
  Cloud,
  Mic,
  MessageCircle,
  Send,
  UploadCloud,
  FileAudio,
  Sparkles,
  Loader2,
  Zap,
  Globe,
  Radio,
  Clock,
} from 'lucide-react';
import { BillingState } from '../services/billing';

interface PlatformHubProps {
  onFilesSelected: (files: FileList | File[]) => void;
  onOpenDriveModal: () => void;
  onOpenRecorderModal: () => void;
  onOpenDePara?: () => void;
  onLoadDemo: () => void;
  onOpenPricing: () => void;
  billingState: BillingState;
  isProcessing: boolean;
  statusMessage?: string;
}

export const PlatformHub: React.FC<PlatformHubProps> = ({
  onFilesSelected,
  onOpenDriveModal,
  onOpenRecorderModal,
  onOpenDePara,
  onLoadDemo,
  onOpenPricing,
  billingState,
  isProcessing,
  statusMessage,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
  };

  const remainingQuota = billingState.freeTrialAudiosTotal - billingState.freeTrialAudiosUsed;

  const [showMobileGuide, setShowMobileGuide] = useState(false);

  return (
    <div className="space-y-6">
      {/* Botões Grandes e Rápidos de Ação para Celular (Pensado no Pai / Celular) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <button
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          disabled={isProcessing}
          className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-left shadow-lg shadow-emerald-950/40 flex items-center justify-between gap-4 transition-all active:scale-[0.98] group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <UploadCloud className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold leading-tight">
                Escolher Áudio ou Conversa
              </div>
              <p className="text-xs text-emerald-100 font-normal mt-0.5">
                Toque aqui para abrir arquivos do seu celular ou WhatsApp
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 rounded-lg bg-black/20 text-xs font-mono">
            Abrir
          </span>
        </button>

        <button
          onClick={onOpenRecorderModal}
          disabled={isProcessing}
          className="p-4 sm:p-5 rounded-2xl bg-zinc-900 border border-zinc-700/80 hover:border-emerald-500/50 hover:bg-zinc-800 text-left shadow-lg flex items-center justify-between gap-4 transition-all active:scale-[0.98] group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <Mic className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-bold text-zinc-100 leading-tight">
                Gravar Minha Voz Agora
              </div>
              <p className="text-xs text-zinc-400 font-normal mt-0.5">
                Grave pelo microfone do celular e receba a transcrição
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 rounded-lg bg-rose-500/10 text-rose-300 text-xs font-mono">
            Gravar
          </span>
        </button>
      </div>

      {/* Guia Simples: Como Usar no Celular (WhatsApp) */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📱</span>
            <h3 className="text-xs sm:text-sm font-bold text-zinc-200">
              Passo a Passo Fácil: Como Transcrever Áudios do WhatsApp no Celular
            </h3>
          </div>
          <button
            onClick={() => setShowMobileGuide(!showMobileGuide)}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
          >
            {showMobileGuide ? 'Recolher Dicas' : 'Ver Dicas'}
          </button>
        </div>

        {showMobileGuide && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-zinc-300">
            <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
              <span className="font-bold text-emerald-400">1. No WhatsApp:</span>
              <p className="text-zinc-400 leading-relaxed">
                Abra a conversa, vá em <strong>Exportar Conversa</strong> (com ou sem mídia). O arquivo contém a conversa em <strong>.TXT</strong> e os áudios.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
              <span className="font-bold text-emerald-400">2. De-Para Automático:</span>
              <p className="text-zinc-400 leading-relaxed">
                Ao selecionar o <strong>ZIP</strong> ou os <strong>áudios + arquivo TXT</strong>, a IA faz o depara da hora do áudio com a mensagem antes de transcrever.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
              <span className="font-bold text-emerald-400">3. TXT Completo & Horas:</span>
              <p className="text-zinc-400 leading-relaxed">
                A IA transcreve tudo na ordem cronológica exata, identifica quem mandou cada áudio e gera o <strong>TXT completo sem perder as horas</strong>!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quota Banner */}
      <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-zinc-200">
              {billingState.isPremium ? 'Plano Pro Ativo' : 'Cota Gratuita de Testes:'}
            </span>
            <span className="text-zinc-400 ml-1.5 font-mono">
              {billingState.isPremium
                ? 'Transcrições ilimitadas liberadas'
                : `${remainingQuota} de ${billingState.freeTrialAudiosTotal} transcrições completas gratuitas disponíveis`}
            </span>
          </div>
        </div>

        <button
          onClick={onOpenPricing}
          className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
            billingState.isPremium
              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
          }`}
        >
          <span>{billingState.isPremium ? 'Ver Detalhes do Plano' : 'Ver Planos & Recargas'}</span>
        </button>
      </div>

      {/* Grid de Plataformas Conectáveis */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Conectar Outras Plataformas
          </h3>
          <span className="text-[11px] text-zinc-500 font-mono">Multiplataforma</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 1. Google Drive */}
          <button
            onClick={onOpenDriveModal}
            disabled={isProcessing}
            className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-start gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-zinc-100 group-hover:text-blue-400 transition-colors">
                  Google Drive
                </h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono">
                  Nuvem
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                Busca automática e download de arquivos ZIP e áudios armazenados no seu Drive.
              </p>
            </div>
          </button>

          {/* 2. WhatsApp */}
          <button
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            disabled={isProcessing}
            className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-start gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">
                  WhatsApp
                </h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono">
                  Conversas & Áudios
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                Importe a exportação do chat (.zip com _chat.txt) ou selecione áudios e o arquivo .txt juntos para o De-Para de horários.
              </p>
            </div>
          </button>

          {/* 3. Microfone Direto */}
          <button
            onClick={onOpenRecorderModal}
            disabled={isProcessing}
            className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-start gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0 group-hover:scale-105 transition-transform">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-zinc-100 group-hover:text-rose-400 transition-colors">
                  Gravar Microfone
                </h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 font-mono">
                  Ao Vivo
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                Grave um áudio agora mesmo pelo navegador para transcrição imediata.
              </p>
            </div>
          </button>

          {/* 4. Telegram & Mensageiros */}
          <button
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            disabled={isProcessing}
            className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-start gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-zinc-100 group-hover:text-sky-400 transition-colors">
                  Telegram & Mensageiros
                </h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 font-mono">
                  Voz & Mídia
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                Suporte para gravações e chats exportados do Telegram e outros apps.
              </p>
            </div>
          </button>

          {/* 5. Áudios Avulsos ou Pastas */}
          <button
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            disabled={isProcessing}
            className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-start gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
              <FileAudio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">
                  Arquivos Avulsos
                </h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono">
                  MP3 / OPUS / WAV
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                Selecione múltiplos arquivos de áudio individuais para transcrever de uma só vez.
              </p>
            </div>
          </button>

          {/* 6. De-Para WhatsApp por Horários */}
          <button
            onClick={() => onOpenDePara && onOpenDePara()}
            disabled={isProcessing}
            className="p-4 rounded-2xl bg-zinc-900/60 border border-emerald-500/30 hover:border-emerald-500 hover:bg-zinc-900 text-left transition-all flex items-start gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-zinc-100 group-hover:text-teal-400 transition-colors">
                  De-Para WhatsApp
                </h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300 font-mono">
                  Horários & Nomes
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                Vincule o arquivo .txt exportado do WhatsApp para identificar quem mandou cada áudio mantendo as mesmas horas.
              </p>
            </div>
          </button>

          {/* 7. Demonstração Imediata */}
          <button
            onClick={onLoadDemo}
            disabled={isProcessing}
            className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-start gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-zinc-100 group-hover:text-indigo-400 transition-colors">
                  Teste Imediato
                </h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">
                  1 Clique
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                Carregue uma conversa de exemplo com áudios para testar a transcrição agora.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Área Central de Drag & Drop Universal */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
          isDragOver
            ? 'border-emerald-500 bg-emerald-500/5 scale-[1.01]'
            : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60'
        } ${isProcessing ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.txt,.opus,.ogg,.mp3,.m4a,.wav,.aac,.amr,.webm,.jpg,.jpeg,.png,.webp,.gif,.mp4,.3gp,.mov,.m4v"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        {isProcessing ? (
          <div className="space-y-3 py-4">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-200">
              Processando arquivos de mídia...
            </h3>
            <p className="text-xs text-zinc-400 font-mono">
              {statusMessage || 'Extraindo e analisando conteúdo (áudios, fotos, vídeos)...'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-lg mx-auto">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300 shadow-inner">
              <UploadCloud className="w-7 h-7 text-emerald-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-100 sm:text-base">
                Arraste seu arquivo ZIP do WhatsApp, áudios, fotos, vídeos ou TXT aqui
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Suporta exportações (<span className="font-mono text-zinc-300">.zip</span>), conversas (<span className="font-mono text-zinc-300">.txt</span>), áudios (<span className="font-mono text-zinc-300">.opus, .ogg, .mp3, .m4a</span>), fotos (<span className="font-mono text-zinc-300">.jpg, .png</span>) e vídeos (<span className="font-mono text-zinc-300">.mp4, .mov</span>).
              </p>
            </div>

            <div className="pt-2">
              <span className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 font-semibold border border-zinc-700/60 inline-block transition-colors">
                Selecionar Arquivos do Dispositivo
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
