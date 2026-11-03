import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, RotateCcw, Check, X, AlertCircle } from 'lucide-react';

interface AudioRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAudioRecorded: (blob: Blob, fileName: string) => void;
}

export const AudioRecorderModal: React.FC<AudioRecorderModalProps> = ({
  isOpen,
  onClose,
  onAudioRecorded,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  const startRecording = async () => {
    setPermissionError(null);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Erro ao acessar microfone:', err);
      setPermissionError(
        'Permissão de microfone negada ou dispositivo não disponível. Permita o microfone no navegador.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleReset = () => {
    if (isRecording) {
      stopRecording();
    }
    setAudioUrl(null);
    setRecordedBlob(null);
    setRecordingSeconds(0);
    clearInterval(timerRef.current);
  };

  const handleConfirm = () => {
    if (recordedBlob) {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      const name = `GRAVACAO-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${timeStr}.webm`;
      onAudioRecorded(recordedBlob, name);
      onClose();
    }
  };

  if (!isOpen) return null;

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Gravar Áudio Direto</h3>
              <p className="text-[11px] text-zinc-400">Grave agora pelo microfone e transcreva na hora</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {permissionError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{permissionError}</span>
          </div>
        )}

        {/* Recording Center */}
        <div className="text-center py-6 space-y-4">
          <div className="relative inline-flex items-center justify-center">
            {isRecording && (
              <span className="absolute w-24 h-24 rounded-full bg-emerald-500/20 animate-ping" />
            )}
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : audioUrl
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer'
              }`}
              onClick={!audioUrl ? (isRecording ? stopRecording : startRecording) : undefined}
            >
              {isRecording ? (
                <Square className="w-7 h-7 fill-white" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {formatTimer(recordingSeconds)}
            </div>
            <p className="text-xs text-zinc-400">
              {isRecording
                ? 'Gravando... Clique no quadrado vermelho para parar'
                : audioUrl
                ? 'Gravação concluída com sucesso!'
                : 'Clique no microfone para iniciar a gravação'}
            </p>
          </div>

          {audioUrl && (
            <div className="pt-2 space-y-3">
              <audio controls src={audioUrl} className="w-full h-9 opacity-90 mx-auto" />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <button
            onClick={handleReset}
            disabled={isRecording || !audioUrl}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 flex items-center gap-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Gravar de Novo</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!audioUrl || isRecording}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white disabled:text-zinc-500 rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Transcrever Este Áudio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
