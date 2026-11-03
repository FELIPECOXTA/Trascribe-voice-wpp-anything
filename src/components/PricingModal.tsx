import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  Lock,
  QrCode,
  CreditCard,
  Copy,
  CheckCircle2,
  X,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { BillingState, activatePremiumPlan, resetToFreePlan } from '../services/billing';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  billingState: BillingState;
  onBillingUpdated: (newState: BillingState) => void;
  activeZipName?: string;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  billingState,
  onBillingUpdated,
  activeZipName,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'single_zip' | 'unlimited_pro'>('single_zip');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [copiedPix, setCopiedPix] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);

  if (!isOpen) return null;

  const pixCode =
    selectedPlan === 'single_zip'
      ? '00020126580014br.gov.bcb.pix0136zaps-transcricao-zip@pix.pagamento52040000530398654049.905802BR5925ZAPSCRIBE TRANSCRIBER6009SAO PAULO62070503***6304ABCD'
      : '00020126580014br.gov.bcb.pix0136zaps-pro-mensal@pix.pagamento520400005303986540529.905802BR5925ZAPSCRIBE TRANSCRIBER6009SAO PAULO62070503***6304WXYZ';

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handleConfirmPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const updated = activatePremiumPlan(selectedPlan, activeZipName);
      onBillingUpdated(updated);
      setIsProcessing(false);
      setJustUnlocked(true);
      setTimeout(() => {
        setJustUnlocked(false);
        onClose();
      }, 1500);
    }, 800);
  };

  const handleResetFree = () => {
    const updated = resetToFreePlan();
    onBillingUpdated(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100">
                  Cota de Teste & Planos de Acesso
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  {billingState.freeTrialAudiosTotal - billingState.freeTrialAudiosUsed} de {billingState.freeTrialAudiosTotal} testes restantes
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Transcreva áudios de teste gratuitamente para avaliar a IA. Libere conversas completas sem limites.
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

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {billingState.isPremium ? (
            /* Já é Premium */
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">
                  Seu Plano Premium Está Ativo!
                </h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                  Todas as transcrições de áudios e conversas estão 100% liberadas sem limites de cota.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition-all"
                >
                  Continuar Usando
                </button>
                <button
                  onClick={handleResetFree}
                  className="px-3.5 py-2 text-xs text-zinc-500 hover:text-zinc-300 underline"
                >
                  Reiniciar Cota de Testes
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Card explicativo da cota de teste */}
              <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-xs text-zinc-300 leading-relaxed">
                  <strong className="text-emerald-400">Cota de Degustação Gratuita:</strong> Você tem{' '}
                  <span className="font-mono text-zinc-100 font-bold">{billingState.freeTrialAudiosTotal - billingState.freeTrialAudiosUsed} de {billingState.freeTrialAudiosTotal}</span>{' '}
                  transcrições completas gratuitas para comprovar a fidelidade da IA. Para processar conversas inteiras ou lotes maiores, escolha um plano abaixo.
                </div>
              </div>

              {/* Seletor de Planos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Plano 1: Desbloqueio Deste ZIP */}
                <div
                  onClick={() => setSelectedPlan('single_zip')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                    selectedPlan === 'single_zip'
                      ? 'bg-emerald-950/20 border-emerald-500 ring-1 ring-emerald-500/40 shadow-lg'
                      : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-zinc-200">Desbloqueio Avulso</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      Este Arquivo
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 my-2">
                    <span className="text-2xl font-bold font-mono text-zinc-100">R$ 9,90</span>
                    <span className="text-xs text-zinc-500">pagamento único</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Libera todos os áudios completos do arquivo atual com exportação em TXT, JSON e CSV.
                  </p>
                </div>

                {/* Plano 2: Pro Ilimitado */}
                <div
                  onClick={() => setSelectedPlan('unlimited_pro')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                    selectedPlan === 'unlimited_pro'
                      ? 'bg-emerald-950/20 border-emerald-500 ring-1 ring-emerald-500/40 shadow-lg'
                      : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-zinc-200">Plano Pro Ilimitado</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      Recomendado
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 my-2">
                    <span className="text-2xl font-bold font-mono text-zinc-100">R$ 29,90</span>
                    <span className="text-xs text-zinc-500">/ mês</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Áudios ilimitados, arquivos ZIP múltiplos e transcrição de qualquer tamanho.
                  </p>
                </div>
              </div>

              {/* Forma de Pagamento */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200">Forma de Pagamento:</span>
                  <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pix')}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors flex items-center gap-1.5 ${
                        paymentMethod === 'pix'
                          ? 'bg-emerald-600 text-white font-medium'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>PIX (Instantâneo)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors flex items-center gap-1.5 ${
                        paymentMethod === 'card'
                          ? 'bg-emerald-600 text-white font-medium'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Cartão</span>
                    </button>
                  </div>
                </div>

                {paymentMethod === 'pix' ? (
                  /* Área PIX */
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Simulação de QR Code */}
                      <div className="w-28 h-28 bg-white p-2 rounded-xl flex items-center justify-center shrink-0 shadow-md">
                        <div className="w-full h-full border-2 border-dashed border-zinc-800 rounded flex flex-col items-center justify-center text-zinc-900 text-[10px] font-mono text-center p-1">
                          <QrCode className="w-12 h-12 text-zinc-900" />
                          <span className="font-bold text-[9px] mt-0.5">PIX QR Code</span>
                        </div>
                      </div>

                      <div className="flex-1 space-y-2 text-center sm:text-left min-w-0">
                        <p className="text-xs text-zinc-300">
                          Abra o app do seu banco, escolha <strong>Pagar com PIX</strong> e aponte a
                          câmera para o QR Code ou copie a chave abaixo:
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={pixCode}
                            className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-[11px] font-mono px-2.5 py-1.5 rounded-lg flex-1 truncate select-all"
                          />
                          <button
                            type="button"
                            onClick={handleCopyPix}
                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0"
                          >
                            {copiedPix ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copiar Chave</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Simulação de Cartão */
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3">
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">Número do Cartão</label>
                        <input
                          type="text"
                          placeholder="4532 •••• •••• 8910"
                          defaultValue="4532 8912 3456 7890"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-zinc-400 block mb-1">Validade</label>
                          <input
                            type="text"
                            placeholder="MM/AA"
                            defaultValue="12/28"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400 block mb-1">CVV</label>
                          <input
                            type="text"
                            placeholder="123"
                            defaultValue="789"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botão de confirmação de pagamento */}
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={isProcessing}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98"
                >
                  {isProcessing ? (
                    <span>Validando pagamento...</span>
                  ) : justUnlocked ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                      <span>Transcrições Completas Desbloqueadas!</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>
                        Confirmar Pagamento de{' '}
                        {selectedPlan === 'single_zip' ? 'R$ 9,90' : 'R$ 29,90'} e Desbloquear
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Ambiente seguro SSL · Liberação imediata das transcrições</span>
          <button
            onClick={onClose}
            className="px-3 py-1 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
