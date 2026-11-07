export interface BillingState {
  isPremium: boolean;
  planName: 'free' | 'single_zip' | 'unlimited_pro';
  activatedAt?: string;
  freeTrialAudiosTotal: number;
  freeTrialAudiosUsed: number;
  unlockedZipNames: string[];
}

const STORAGE_KEY = 'zaps_billing_quota_v2';

export function getStoredBilling(): BillingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Erro ao ler billing state:', e);
  }
  return {
    isPremium: false,
    planName: 'free',
    freeTrialAudiosTotal: 3, // 3 áudios completos gratuitos de teste
    freeTrialAudiosUsed: 0,
    unlockedZipNames: [],
  };
}

export function saveBillingState(state: BillingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Erro ao salvar billing state:', e);
  }
}

/**
 * Consome 1 áudio da cota de teste gratuito
 */
export function consumeFreeTrialQuota(): { allowed: boolean; remaining: number } {
  const current = getStoredBilling();
  if (current.isPremium) {
    return { allowed: true, remaining: 9999 };
  }

  const remaining = current.freeTrialAudiosTotal - current.freeTrialAudiosUsed;
  if (remaining <= 0) {
    return { allowed: false, remaining: 0 };
  }

  current.freeTrialAudiosUsed += 1;
  saveBillingState(current);
  return { allowed: true, remaining: current.freeTrialAudiosTotal - current.freeTrialAudiosUsed };
}

export function canTranscribeAudio(): boolean {
  const current = getStoredBilling();
  if (current.isPremium) return true;
  return current.freeTrialAudiosUsed < current.freeTrialAudiosTotal;
}

export function activatePremiumPlan(plan: 'single_zip' | 'unlimited_pro', zipName?: string): BillingState {
  const current = getStoredBilling();
  const unlocked = new Set(current.unlockedZipNames);
  if (zipName) {
    unlocked.add(zipName);
  }

  const newState: BillingState = {
    ...current,
    isPremium: true,
    planName: plan,
    activatedAt: new Date().toISOString(),
    unlockedZipNames: Array.from(unlocked),
  };

  saveBillingState(newState);
  return newState;
}

export function resetToFreePlan(): BillingState {
  const newState: BillingState = {
    isPremium: false,
    planName: 'free',
    freeTrialAudiosTotal: 3,
    freeTrialAudiosUsed: 0,
    unlockedZipNames: [],
  };
  saveBillingState(newState);
  return newState;
}

/**
 * Valida código de acesso/cupom VIP no servidor
 */
export async function validatePasscodeOnServer(code: string): Promise<{
  valid: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/billing/validate-passcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      activatePremiumPlan('unlimited_pro');
      return { valid: true, message: data.message };
    }
    return { valid: false, error: data.error || 'Código inválido ou não autorizado.' };
  } catch (err: any) {
    return { valid: false, error: 'Erro de conexão com o servidor de validação.' };
  }
}

/**
 * Consulta a cota server-side do cliente
 */
export async function fetchServerQuota(): Promise<{
  totalFree: number;
  used: number;
  remaining: number;
} | null> {
  try {
    const res = await fetch('/api/billing/quota');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Não foi possível sincronizar cota com servidor:', e);
  }
  return null;
}

