// "Sync with Lab", anywhere it's offered (Home, a session's photos): sends the visits and Label
// later photos waiting, asks which of those Lab has labelled, and says what happened.
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { recheckLab } from './labHealth';
import { uploader } from './lab';
import { fetchCaptureStates } from './labData';
import { syncAll, type SyncResult } from './outbox';
import { fileDrafts, fileOutbox } from './outboxFiles';
import { useCapture } from './store';

export type LabSync = SyncResult & { labelledInLab: number };

/** `after` runs once a sync is done (to reload what's shown). */
export function useSyncWithLab(after?: (r: LabSync) => void) {
  const { t } = useTranslation('capture');
  const labUrl = useCapture((s) => s.labUrl);
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // One at a time; a ref, so `sync` stays the same function (screens list it as a dependency).
  const busy = useRef(false);

  const sync = useCallback(async () => {
    if (!labUrl || busy.current) return;
    busy.current = true;
    setSyncing(true);
    setNote(null);
    const r = await syncAll(fileOutbox, fileDrafts, uploader(labUrl), async (ids) => {
      const got = await fetchCaptureStates(labUrl, ids);
      return got.ok ? got.data.states : null;
    });
    busy.current = false;
    setSyncing(false);
    const notes: string[] = [];
    if (r.sent) notes.push(t('home.synced', { sent: r.sent }));
    if (r.labelledInLab) notes.push(t('home.labelledInLab', { count: r.labelledInLab }));
    if (r.rejected.length) {
      notes.push(t('home.syncRejected', { count: r.rejected.length, error: r.rejected[0]!.error }));
    }
    if (r.offline) notes.push(t('home.syncOffline', { error: r.offline }));
    setNote(notes.join(' · ') || t('home.upToDate'));
    // What it found about Lab, for the pill on every screen.
    void recheckLab(labUrl);
    after?.(r);
  }, [labUrl, t, after]);

  return { labUrl, syncing, note, sync };
}
