import React, { useState, useEffect } from 'react';
import { Cloud, Search, Loader2, Download, FileArchive, RefreshCw, X, AlertCircle } from 'lucide-react';
import { DriveFileItem, searchDriveFiles, downloadDriveFile } from '../services/googleDrive';

interface DriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  onLogin: () => void;
  onFileDownloaded: (arrayBuffer: ArrayBuffer, fileName: string) => void;
}

export const DriveModal: React.FC<DriveModalProps> = ({
  isOpen,
  onClose,
  token,
  onLogin,
  onFileDownloaded,
}) => {
  const [searchTerm, setSearchTerm] = useState('WhatsApp');
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchFiles = async (termToSearch: string) => {
    if (!token) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const results = await searchDriveFiles(token, termToSearch);
      setFiles(results);
      if (results.length === 0) {
        setErrorMessage(`Nenhum arquivo contendo "${termToSearch}" encontrado no seu Google Drive.`);
      }
    } catch (err: any) {
      console.error('Erro ao buscar arquivos no Drive:', err);
      setErrorMessage(err.message || 'Falha ao consultar arquivos no Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && token) {
      fetchFiles(searchTerm);
    }
  }, [isOpen, token]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFiles(searchTerm);
  };

  const handleDownload = async (file: DriveFileItem) => {
    if (!token) return;
    setDownloadingId(file.id);
    setDownloadProgress(0);
    setErrorMessage(null);

    try {
      const buffer = await downloadDriveFile(file.id, token, (loaded, total) => {
        if (total && total > 0) {
          setDownloadProgress(Math.round((loaded / total) * 100));
        }
      });
      onFileDownloaded(buffer, file.name);
      onClose();
    } catch (err: any) {
      console.error('Erro ao baixar arquivo do Drive:', err);
      setErrorMessage(`Erro ao baixar "${file.name}": ${err.message}`);
    } finally {
      setDownloadingId(null);
      setDownloadProgress(null);
    }
  };

  const formatFileSize = (bytesStr?: string) => {
    if (!bytesStr) return 'Tamanho desconhecido';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return 'Tamanho desconhecido';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Localizar Conversas ZIP no Google Drive
              </h2>
              <p className="text-xs text-zinc-400">
                Selecione qualquer arquivo ZIP exportado do WhatsApp armazenado no seu Drive
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

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {!token ? (
            <div className="text-center py-10 px-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                <Cloud className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-sm font-semibold text-zinc-200">
                  Conexão com Google Drive necessária
                </h3>
                <p className="text-xs text-zinc-400">
                  Para buscar e descompactar o arquivo "TRANSCREVA TUDO" ou suas conversas e áudios diretamente da sua nuvem,
                  faça login com sua conta do Google com permissão de leitura.
                </p>
              </div>
              <button
                onClick={onLogin}
                className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-all hover:scale-[1.02] active:scale-95"
              >
                <Cloud className="w-4 h-4" />
                <span>Conectar Conta Google</span>
              </button>
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Digite o nome do arquivo (ex: TRANSCREVA TUDO, WhatsApp ou .zip)..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Buscar</span>
                </button>
              </form>

              {/* Quick Filter Tags */}
              <div className="flex items-center gap-2 text-xs text-zinc-400 pt-1">
                <span className="text-zinc-500">Sugestões rápidas:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('TRANSCREVA TUDO');
                    fetchFiles('TRANSCREVA TUDO');
                  }}
                  className="px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors"
                >
                  "TRANSCREVA TUDO"
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('.zip');
                    fetchFiles('.zip');
                  }}
                  className="px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors"
                >
                  Todos os .zip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('WhatsApp');
                    fetchFiles('WhatsApp');
                  }}
                  className="px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors"
                >
                  WhatsApp
                </button>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* File List */}
              <div className="space-y-2 mt-2">
                {isLoading ? (
                  <div className="py-12 text-center text-zinc-400 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-400" />
                    <p className="text-xs">Consultando arquivos no Google Drive...</p>
                  </div>
                ) : files.length > 0 ? (
                  files.map((file) => {
                    const isDownloading = downloadingId === file.id;
                    const isZip = file.name.toLowerCase().endsWith('.zip');

                    return (
                      <div
                        key={file.id}
                        className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 flex items-center justify-between gap-4 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              isZip
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            <FileArchive className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-zinc-200 truncate">
                              {file.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                              <span>{formatFileSize(file.size)}</span>
                              <span>·</span>
                              <span>Modificado: {formatDate(file.modifiedTime)}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDownload(file)}
                          disabled={isDownloading || Boolean(downloadingId)}
                          className="shrink-0 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white disabled:text-zinc-500 rounded-lg text-xs font-medium transition-all flex items-center gap-2"
                        >
                          {isDownloading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>{downloadProgress !== null ? `${downloadProgress}%` : 'Baixando...'}</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>Baixar & Abrir</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  !errorMessage && (
                    <div className="py-8 text-center text-zinc-500 text-xs">
                      Nenhum resultado para exibir.
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-500">
          <span>Escopo seguro: somente leitura aos arquivos do Drive</span>
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
