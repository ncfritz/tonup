// "Play again" on New game: your last few distinct set-ups (game, its settings and line-up).
import type { PlayerRef } from '@/domain/darts';
import { getSession, recentSessions } from '@/services/db/sessionsRepo';

import { isPresetId, presetOf, type PresetId } from '../game/presets';

export interface Setup {
  presetId: PresetId;
  settings: Record<string, unknown>;
  players: PlayerRef[];
}

export function recentSetups(limit = 2): Setup[] {
  const out: Setup[] = [];
  const seen = new Set<string>();
  for (const id of recentSessions(30, 'game')) {
    const s = getSession(id);
    if (!s) continue;
    const presetId = presetOf(s.typeId, s.settings);
    if (!isPresetId(presetId)) continue;
    // Whatever was dealt is dealt again, so it isn't part of the set-up.
    const { numbers: _dealt, ...settings } = (s.settings ?? {}) as Record<string, unknown>;
    void _dealt;
    const key = `${presetId}|${s.players.map((p) => p.id).join(',')}|${JSON.stringify(settings)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ presetId, settings, players: s.players });
    if (out.length === limit) break;
  }
  return out;
}
