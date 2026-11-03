import React, { useRef, useState } from 'react';
import { UploadCloud, Cloud, FileArchive, Sparkles, Loader2 } from 'lucide-react';

interface ZipDropzoneProps {
  onFileSelected: (file: File) => void;
  onOpenDriveModal: () => void;
  onLoadDemo: () => void;
  isProcessing: boolean;
  statusMessage?: string;
}

export const ZipDropzone: React.FC<ZipDropzoneProps> = ({
  onFileSelected,
  onOpenDriveModal,
  onLoadDemo,
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
      const file = files[0];
      if (file.name.toLowerCase().endsWith('.zip')) {
        onFileSelected(file);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelected(files[0]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Principal Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
          isDragOver
            ? 'border-emerald-500 bg-emerald-500/5 scale-[1.01]'
            : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60'
        } ${isProcessing ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {isProcessing ? (
          <div className="space-y-3 py-4">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-200">
              Descompactando e indexando arquivos...
            </h3>
            <p className="text-xs text-zinc-400 font-mono">
              {statusMessage || 'Processando conteúdo do ZIP...'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-md mx-auto">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300 shadow-inner">
              <UploadCloud className="w-7 h-7 text-emerald-400" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-zinc-100 sm:text-base">
                Carregue o arquivo ZIP da Conversa
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Arraste o arquivo ZIP exportado do WhatsApp ou clique para procurar no seu computador.
                Compatível com <span className="font-mono text-zinc-300">_chat.txt</span> e áudios{' '}
                <span className="font-mono text-zinc-300">.opus</span>,{' '}
                <span className="font-mono text-zinc-300">.m4a</span>,{' '}
                <span className="font-mono text-zinc-300">.mp3</span>.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-zinc-800 text-[11px] text-zinc-300 font-medium border border-zinc-700/50">
                Selecionar ZIP do Computador
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Alternative Actions: Google Drive & Demo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={onOpenDriveModal}
          disabled={isProcessing}
          className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-start gap-3 group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-emerald-400 transition-colors">
              Buscar no Google Drive
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Acesse e baixe arquivos ZIP de conversas armazenados no seu Google Drive.
            </p>
          </div>
        </button>

        <button
          onClick={onLoadDemo}
          disabled={isProcessing}
          className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-left transition-all flex items-start gap-3 group"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-indigo-300 transition-colors">
              Carregar Exemplo de Demonstração
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Experimente a interface com um chat de teste e 3 áudios sintetizados para teste imediato.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};
