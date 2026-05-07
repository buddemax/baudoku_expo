import { formatDateTime } from '../../../lib/formatters';

export const VOICE_TRANSCRIPT_PENDING_DESCRIPTION = 'Sprachnotiz wartet auf Transkription.';

export function mergeTranscriptIntoDescription(
  description: string | null | undefined,
  transcript: string,
  createdAt?: string | null,
) {
  const base = (description ?? '').trim();
  const nextTranscript = transcript.trim();
  if (!nextTranscript) {
    return base;
  }
  if (!base || base === VOICE_TRANSCRIPT_PENDING_DESCRIPTION) {
    return nextTranscript;
  }
  if (base.includes(nextTranscript)) {
    return base;
  }

  const label = createdAt ? `Sprachnotiz vom ${formatDateTime(createdAt)}:` : 'Sprachnotiz:';
  return `${base}\n\n${label}\n${nextTranscript}`;
}
