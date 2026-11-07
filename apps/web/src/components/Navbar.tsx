import React from 'react';
import { User } from 'firebase/auth';
import { Cloud, LogOut, FileArchive, CheckCircle2, Zap, Crown } from 'lucide-react';
import { BillingState } from '../services/billing';

interface NavbarProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn: boolean;
  zipLoadedName?: string;
  billingState: BillingState;
  onOpenPricing: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogin,
  onLogout,
  isLoggingIn,
  zipLoadedName,
  billingState,
  onOpenPricing,
}) => {
  return (
    <header className="stitch-topbar border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <FileArchive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-100 text-base tracking-tight">
                Transcreva Tudo AI
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono hidden sm:inline-block">
                WhatsApp & Drive
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-zinc-400 truncate max-w-[200px] sm:max-w-none">
              Transcritor Inteligente com De-Para de Horários e Conversas
            </p>
          </div>
        </div>

        {/* Status, Billing & Auth */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {zipLoadedName && (
            <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-zinc-500">Arquivo:</span>
              <span className="font-mono text-zinc-200 truncate max-w-[160px]">
                {zipLoadedName}
              </span>
            </div>
          )}

          {/* Plan Indicator / Upgrade Button */}
          {billingState.isPremium ? (
            <button
              onClick={onOpenPricing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold transition-all"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xs:inline">Plano</span> <span>Pro Ilimitado</span>
            </button>
          ) : (
            <button
              onClick={onOpenPricing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Planos & Cota</span>
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 pr-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Usuário'}
                  className="w-7 h-7 rounded-full border border-zinc-700 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-950 text-emerald-400 text-xs flex items-center justify-center font-bold">
                  {user.email ? user.email[0].toUpperCase() : 'U'}
                </div>
              )}
              <div className="text-left hidden sm:block">
                <p className="text-xs font-medium text-zinc-200 leading-none">
                  {user.displayName || 'Google Conectado'}
                </p>
                <p className="text-[11px] text-zinc-500 truncate max-w-[120px] leading-tight">
                  {user.email}
                </p>
              </div>
              <button
                onClick={onLogout}
                title="Desconectar do Google"
                className="text-zinc-400 hover:text-rose-400 p-1 transition-colors ml-1"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              disabled={isLoggingIn}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">{isLoggingIn ? 'Conectando...' : 'Google Drive'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
