import React, { useState, useRef } from 'react';
import {
  FileText,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  UploadCloud,
  Users,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { ExtractedAudioFile } from '../services/zipParser';
import { parseWhatsAppChat, ParsedChat } from '../services/chatParser';

interface DeParaModalProps {
  isOpen: boolean;
  onClose: () => void;
  audiosList: ExtractedAudioFile[];
  onApplyDePara: (newParsedChat: ParsedChat, sourceName: string) => void;
}

export const DeParaModal: React.FC<DeParaModalProps> = ({
  isOpen,
  onClose,
  audiosList,
  onApplyDePara,
}) => {
  const [txtFileName, setTxtFileName] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultStats, setResultStats] = useState<{
    matched: number;
    participants: string[];
    totalMsgs: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setErrorMsg(null);
      setTxtFileName(file.name);

      const text = await file.text();
      setPastedText(text);
      executeDePara(text, file.name);
    } catch (err: any) {
      setErrorMsg(`Erro ao ler o arquivo de texto: ${err.message || 'Arquivo inválido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeDePara = (text: string, sourceName: string = 'conversa_whatsapp.txt') => {
    if (!text.trim()) {
      setErrorMsg('Cole o texto da conversa ou selecione o arquivo .txt exportado do WhatsApp.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMsg(null);

      // Constrói o mapa de áudios a partir da lista atual
      const audioMap = new Map<string, ExtractedAudioFile>();
      for (const a of audiosList) {
        audioMap.set(a.name, a);
        audioMap.set(a.cleanName, a);
      }

      // Executa o De-Para de horários e remetentes
      const parsed = parseWhatsAppChat(text, audioMap);

      const matchedCount = parsed.messages.filter((m) => m.isAudio && m.audioFile).length;

      setResultStats({
        matched: matchedCount,
        participants: parsed.participants,
        totalMsgs: parsed.messages.length,
      });

      // Aplica ao app
      onApplyDePara(parsed, sourceName);
    } catch (err: any) {
      console.error('Falha no De-Para:', err);
      setErrorMsg(`Erro ao processar correlação: ${err.message || 'Formato de conversa não reconhecido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>De-Para por Horários do WhatsApp</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  IA & Sincronização
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Lê os horários exatos das mensagens e identifica quem enviou cada áudio na conversa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Instrução Amigável */}
          <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-zinc-300 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Como funciona a identificação de remetentes?</span>
            </div>
            <p className="text-zinc-300 leading-relaxed">
              O WhatsApp exporta o texto da conversa no arquivo <span className="font-mono text-emerald-300">_chat.txt</span> com os nomes das pessoas e os horários das mensagens. Nosso sistema compara o minuto e segundo de cada áudio com as mensagens do texto para:
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-1">
              <li>Identificar exatamente <strong>quem gravou cada áudio</strong> (ex: Maria, João).</li>
              <li><strong>Manter a mesma hora</strong> de cada mensagem na linha do tempo cronológica.</li>
              <li>Integrar as transcrições no lugar exato onde foram faladas na conversa.</li>
            </ul>
          </div>

          {/* Upload de arquivo TXT */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 block">
              1. Selecionar arquivo de texto exportado do WhatsApp (.txt)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full p-4 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-emerald-500/50 hover:bg-zinc-800/40 transition-all text-center flex flex-col items-center justify-center gap-2 group"
            >
              <UploadCloud className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
              <div>
                <span className="text-xs sm:text-sm font-semibold text-zinc-200">
                  {txtFileName ? `Arquivo selecionado: ${txtFileName}` : 'Clique para escolher o arquivo _chat.txt'}
                </span>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Geralmente chamado _chat.txt ou Conversa do WhatsApp com [Nome].txt
                </p>
              </div>
            </button>
          </div>

          {/* Ou colar o texto diretamente */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">
                2. Ou cole o texto da conversa aqui diretamente:
              </label>
              {pastedText && (
                <button
                  onClick={() => {
                    setPastedText('');
                    setTxtFileName('');
                    setResultStats(null);
                  }}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300"
                >
                  Limpar
                </button>
              )}
            </div>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Cole aqui o texto da conversa exportada do WhatsApp... Ex:
[14/08/2023, 19:42:15] Carlos: Olá, tudo bem?
[14/08/2023, 19:42:40] Maria: <anexado: AUDIO-2023-08-14-19-42-40.opus>
14/08/2023 19:43 - Carlos: <Mensagem de voz omitida>"
              rows={6}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3.5 text-xs text-zinc-200 placeholder:text-zinc-600 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Feedback de erro */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Resultado com Sucesso */}
          {resultStats && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>De-Para Realizado com Sucesso!</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block">Áudios Vinculados</span>
                  <span className="font-bold text-emerald-400 text-sm">{resultStats.matched}</span>
                </div>
                <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block">Remetentes Achados</span>
                  <span className="font-bold text-zinc-200 text-sm">
                    {resultStats.participants.length}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-500 text-[10px] block">Mensagens no Chat</span>
                  <span className="font-bold text-zinc-200 text-sm">{resultStats.totalMsgs}</span>
                </div>
              </div>
              {resultStats.participants.length > 0 && (
                <div className="text-xs text-zinc-400 flex items-center gap-1.5 flex-wrap">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Participantes:</span>
                  <span className="text-zinc-200 font-medium">
                    {resultStats.participants.join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-400 font-mono">
            {audiosList.length} áudios carregados na fila
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
            >
              {resultStats ? 'Concluir e Ver Chat' : 'Cancelar'}
            </button>
            <button
              onClick={() => executeDePara(pastedText, txtFileName || 'conversa_whatsapp.txt')}
              disabled={isProcessing || !pastedText.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white transition-all shadow-md flex items-center gap-1.5"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <span>Executar De-Para</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
