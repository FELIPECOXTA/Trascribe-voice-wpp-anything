import React from 'react';
import { MessageSquare, Headphones, Mic, Download, Zap, Crown } from 'lucide-react';
import { BillingState } from '../services/billing';

interface MobileBottomNavProps {
  activeTab: 'chat' | 'queue';
  setActiveTab: (tab: 'chat' | 'queue') => void;
  onOpenRecorder: () => void;
  onOpenExport: () => void;
  onOpenPricing: () => void;
  hasLoadedChat: boolean;
  billingState: BillingState;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenRecorder,
  onOpenExport,
  onOpenPricing,
  hasLoadedChat,
  billingState,
}) => {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 border-t border-zinc-800/90 backdrop-blur-xl px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-pb">
      {hasLoadedChat ? (
        <>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors min-w-[64px] min-h-[48px] ${
              activeTab === 'chat'
                ? 'text-emerald-400 font-bold bg-emerald-500/10'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors min-w-[64px] min-h-[48px] ${
              activeTab === 'queue'
                ? 'text-emerald-400 font-bold bg-emerald-500/10'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Headphones className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Áudios</span>
          </button>

          {/* Quick Record Center Button */}
          <button
            onClick={onOpenRecorder}
            className="flex flex-col items-center justify-center p-2 -mt-4 bg-emerald-600 active:bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-900/50 min-w-[56px] min-h-[56px] transition-transform active:scale-95"
            title="Gravar áudio"
          >
            <Mic className="w-6 h-6" />
            <span className="text-[9px] font-bold">Gravar</span>
          </button>

          <button
            onClick={onOpenExport}
            className="flex flex-col items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-zinc-200 transition-colors min-w-[64px] min-h-[48px]"
          >
            <Download className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Exportar</span>
          </button>

          <button
            onClick={onOpenPricing}
            className="flex flex-col items-center justify-center p-2 rounded-xl text-amber-400 hover:text-amber-300 transition-colors min-w-[64px] min-h-[48px]"
          >
            {billingState.isPremium ? (
              <Crown className="w-5 h-5 mb-0.5" />
            ) : (
              <Zap className="w-5 h-5 mb-0.5" />
            )}
            <span className="text-[10px] font-semibold">{billingState.isPremium ? 'Pro' : 'Planos'}</span>
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onOpenRecorder}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md"
          >
            <Mic className="w-4 h-4" />
            <span>Gravar no Microfone</span>
          </button>

          <button
            onClick={onOpenPricing}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl text-xs font-medium"
          >
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Ver Cota & Planos</span>
          </button>
        </>
      )}
    </nav>
  );
};
