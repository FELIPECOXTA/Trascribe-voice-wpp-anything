/**
 * Compartilha o texto transcrito nativamente pelo celular ou abre direto no WhatsApp
 */
export async function shareTranscript(text: string, title: string = 'Transcrição ZapScribe'): Promise<boolean> {
  // Se o navegador do celular suportar a API nativa de compartilhamento
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title,
        text,
      });
      return true;
    } catch (err: any) {
      // Se o usuário cancelou o compartilhamento, não é erro grave
      if (err.name === 'AbortError') return true;
    }
  }

  // Fallback seguro usando link dinâmico ou cópia para área de transferência
  try {
    const encoded = encodeURIComponent(text);
    const waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (e) {
    await navigator.clipboard.writeText(text);
    return true;
  }
}

/**
 * Compartilha o link do aplicativo com amigos pelo WhatsApp para impulsionar divulgação
 */
export function shareAppOnWhatsApp() {
  const msg = 'Olha esse app para transcrever áudios do WhatsApp e gravações de voz no celular ou PC: ' + window.location.href;
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  const link = document.createElement('a');
  link.href = waUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
