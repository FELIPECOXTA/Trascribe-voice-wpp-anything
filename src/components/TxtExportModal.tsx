import React, { useState, useMemo } from 'react';
import { Download, Copy, Check, FileText, FileCode2, Table, X } from 'lucide-react';
import { ParsedChat } from '../services/chatParser';
import {
  generateUnifiedTxt,
  generateJsonExport,
  generateCsvExport,
  downloadExportFile,
  copyTxtToClipboard,
} from '../services/txtExporter';

type ExportFormat = 'txt' | 'json' | 'csv';

interface TxtExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  txtContent: string;
  parsedChat?: ParsedChat | null;
  sourceName?: string;
}

export const TxtExportModal: React.FC<TxtExportModalProps> = ({
  isOpen,
  onClose,
  txtContent,
  parsedChat,
  sourceName = 'Conversa_Transcrita',
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('txt');
  const [copied, setCopied] = useState(false);

  // Gera o conteúdo específico dependendo do formato selecionado
  const activeContent = useMemo(() => {
    if (!parsedChat) return txtContent;

    switch (selectedFormat) {
      case 'json':
        return generateJsonExport(parsedChat, sourceName);
      case 'csv':
        return generateCsvExport(parsedChat, sourceName);
      case 'txt':
      default:
        return txtContent || generateUnifiedTxt(parsedChat, sourceName);
    }
  }, [selectedFormat, parsedChat, sourceName, txtContent]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const success = await copyTxtToClipboard(activeContent);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    const cleanBaseName = sourceName
      .replace(/\.zip$/i, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    switch (selectedFormat) {
      case 'json':
        downloadExportFile(
          activeContent,
          `${cleanBaseName}_historico_metadados.json`,
          'application/json'
        );
        break;
      case 'csv':
        downloadExportFile(
          activeContent,
          `${cleanBaseName}_planilha_transcricoes.csv`,
          'text/csv'
        );
        break;
      case 'txt':
      default:
        downloadExportFile(
          activeContent,
          `${cleanBaseName}_transcricao_completa.txt`,
          'text/plain'
        );
        break;
    }
  };

  const lineCount = activeContent.split('\n').length;
  const charCount = activeContent.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              {selectedFormat === 'json' ? (
                <FileCode2 className="w-5 h-5" />
              ) : selectedFormat === 'csv' ? (
                <Table className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Exportar Histórico e Transcrições
              </h2>
              <p className="text-xs text-zinc-400">
                Escolha entre TXT corrido, JSON estruturado ou planilha CSV com metadados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Tabs */}
        <div className="px-6 py-2.5 bg-zinc-950/70 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
            <button
              onClick={() => setSelectedFormat('txt')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                selectedFormat === 'txt'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>TXT Completo</span>
            </button>

            <button
              onClick={() => setSelectedFormat('json')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                selectedFormat === 'json'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>JSON Estruturado</span>
            </button>

            <button
              onClick={() => setSelectedFormat('csv')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                selectedFormat === 'csv'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Planilha CSV (Excel)</span>
            </button>
          </div>

          {/* Quick Details */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <span>{lineCount.toLocaleString()} linhas</span>
            <span>·</span>
            <span>{(charCount / 1024).toFixed(1)} KB</span>
          </div>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-2.5 bg-zinc-950/40 border-b border-zinc-800 flex items-center justify-between gap-3 text-xs">
          <span className="text-zinc-400 hidden sm:inline">
            {selectedFormat === 'txt' && 'Texto unificado com diálogo e transcrições na ordem temporal exata.'}
            {selectedFormat === 'json' && 'Árvore de metadados, participantes, timestamps, status e transcrições.'}
            {selectedFormat === 'csv' && 'Formato tabular com codificação UTF-8 pronta para Excel e Google Sheets.'}
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium transition-colors flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar {selectedFormat.toUpperCase()}</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold shadow transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar .{selectedFormat}</span>
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="p-6 flex-1 overflow-y-auto bg-zinc-950">
          <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed select-text">
            {activeContent}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-500">
          <span>Formato selecionado: .{selectedFormat} (UTF-8)</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
