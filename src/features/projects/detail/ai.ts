import type { Session } from '@supabase/supabase-js';

import { aiApi } from '../../../lib/api';
import type { AiJob } from '../../../types/projects';
import { aiJobId, isAiJobFinished, wait } from './helpers';

export const resolveAiJob = async (
  session: Session,
  job: AiJob,
  options: { attempts?: number; intervalMs?: number } = {},
): Promise<AiJob> => {
  let currentJob = job;
  const attempts = options.attempts ?? 4;
  const intervalMs = options.intervalMs ?? 1200;
  for (let attempt = 0; attempt < attempts && !isAiJobFinished(currentJob); attempt += 1) {
    await wait(intervalMs);
    currentJob = await aiApi.getJob(session, aiJobId(currentJob));
  }
  return currentJob;
};
