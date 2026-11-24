/** ElevenLabs Scribe v2: server-side speech-to-text. Keep credentials private. */
export interface ElevenLabsResult {
  transcription: string;
  modelUsed: 'scribe_v2';
  speakersDetected: string[];
}
export class ElevenLabsError extends Error {
  constructor(public status: number) {
    super(`ElevenLabs status ${status}`);
    this.name = 'ElevenLabsError';
  }
}
type Word = { text: string; speaker_id?: string | null; type?: string };

/** Speaker labels are voices within the recording, NOT WhatsApp sender identities. */
export function formatSpeakerTurns(words: Word[], fallback: string): { text: string; speakers: string[] } {
  const ids = Array.from(new Set(words.map(w => w.speaker_id).filter((x): x is string => Boolean(x))));
  if (ids.length < 2) return { text: fallback, speakers: [] };
  const chunks: Array<{ id: string; text: string }> = [];
  for (const word of words) {
    const id = word.speaker_id || 'unknown';
    if (!chunks.length || chunks[chunks.length - 1].id !== id) chunks.push({ id, text: '' });
    const chunk = chunks[chunks.length - 1];
    const t = word.text || '';
    chunk.text += chunk.text && !/^\s|^[.,!?;:]/.test(t) ? ' ' + t : t;
  }
  return {
    text: chunks.map(c => `[${c.id === 'unknown' ? 'Interlocutor não identificado' : `Interlocutor ${ids.indexOf(c.id) + 1}`}]: ${c.text.trim()}`).join('\n'),
    speakers: ids.map((_, i) => `Interlocutor ${i + 1}`),
  };
}
export async function transcribeWithElevenLabs(input: {
  base64: string;
  mimeType: string;
  fileName: string;
}): Promise<ElevenLabsResult> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new ElevenLabsError(503);
  const form = new FormData();
  const buffer = Buffer.from(input.base64, 'base64');
  if (!buffer.length) throw new ElevenLabsError(400);
  form.set('model_id', 'scribe_v2');
  form.set('diarize', 'true');
  form.set('file', new Blob([new Uint8Array(buffer)], { type: input.mimeType }), input.fileName);
  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new ElevenLabsError(response.status);
  const payload = await response.json() as { text?: string; words?: Word[] };
  const raw = (payload.text || '').trim();
  if (!raw) throw new ElevenLabsError(502);
  const result = formatSpeakerTurns(payload.words || [], raw);
  return { transcription: result.text, speakersDetected: result.speakers, modelUsed: 'scribe_v2' };
}
