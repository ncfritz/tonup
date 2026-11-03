import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { removeSession } from './history';

/** How long Undo stays up after a full swipe. */
export const UNDO_MS = 5000;

export interface Pending {
  sessionId: string;
  name: string;
}

/**
 * A full-swipe delete waits a few seconds for Undo before it's done (as in Mail). The row hides
 * at once; the session goes when the time is up, another delete starts, or you leave History.
 */
export function usePendingDelete(onDeleted: () => void) {
  const [pending, setPending] = useState<Pending | null>(null);
  const ref = useRef<{ p: Pending; timer: ReturnType<typeof setTimeout> } | null>(null);
  const deleted = useRef(onDeleted);
  useEffect(() => {
    deleted.current = onDeleted;
  }, [onDeleted]);

  const commit = useCallback(() => {
    const cur = ref.current;
    if (!cur) return;
    clearTimeout(cur.timer);
    ref.current = null;
    removeSession(cur.p.sessionId);
    setPending(null);
    deleted.current();
  }, []);

  const start = useCallback(
    (p: Pending) => {
      commit();
      ref.current = { p, timer: setTimeout(commit, UNDO_MS) };
      setPending(p);
    },
    [commit],
  );

  const undo = useCallback(() => {
    const cur = ref.current;
    if (!cur) return;
    clearTimeout(cur.timer);
    ref.current = null;
    setPending(null);
  }, []);

  // Leaving History (another tab, a replay) finishes the delete.
  useFocusEffect(useCallback(() => commit, [commit]));

  return { pending, start, undo };
}
