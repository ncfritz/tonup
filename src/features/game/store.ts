// The game in progress on the scoring screen: a thin Zustand layer over session.ts, which
// stores every dart. Adds the caller, haptics, and the pause after a leg for the summary.
import { create } from 'zustand';

import { label, miss, type Hit, type Point } from '@/domain/darts';
import i18n from '@/i18n';
import { call } from '@/services/caller';
import { haptics } from '@/services/haptics';

import {
  editDart,
  loadGame,
  recordDart,
  undoLastDart,
  type DartInput,
  type LoadedGame,
} from './session';

interface GameStore {
  game: LoadedGame | null;
  /** A leg just ended: the summary shows and the bot waits until Next leg. */
  legPause: boolean;
  open: (sessionId: string) => void;
  close: () => void;
  throwDart: (input: DartInput) => void;
  /** Records misses for the rest of the visit (Next with darts left). */
  finishVisit: () => void;
  /** Removes the last dart thrown by a person, and any bot darts after it. */
  undo: () => void;
  edit: (
    seq: number,
    change: { hit: Hit; point: Point | null; source: DartInput['source'] },
  ) => void;
  continueAfterLeg: () => void;
}

const isBot = (game: LoadedGame, playerId: string) =>
  game.session.players.find((p) => p.id === playerId)?.botLevel !== undefined;

export const useGame = create<GameStore>((set, get) => ({
  game: null,
  legPause: false,
  open: (sessionId) => {
    const game = loadGame(sessionId);
    const visits = game.def.visits(game.state);
    const last = visits[visits.length - 1];
    // Reopened right after a checkout: show that leg's summary again.
    set({ game, legPause: !!last?.endsLeg && game.def.result(game.state) === null });
  },
  close: () => set({ game: null, legPause: false }),
  throwDart: (input) => {
    const { game, legPause } = get();
    if (!game || legPause) return;
    const next = recordDart(game, input);
    set({ game: next });
    announce(next);
  },
  finishVisit: () => {
    const { game } = get();
    if (!game) return;
    const visits = game.def.visits(game.state);
    const visit = visits[visits.length - 1];
    const thrown = visit && !visit.done ? visit.darts.length : 0;
    if (thrown === 0) return;
    for (let i = thrown; i < 3; i++)
      get().throwDart({ hit: miss(), point: null, source: 'keypad' });
  },
  undo: () => {
    let { game } = get();
    if (!game || !game.darts.some((d) => !isBot(game!, d.playerId))) return;
    // Bots replay their own darts, so undo goes back to the last person's dart.
    while (game.darts.length) {
      const last = game.darts[game.darts.length - 1]!;
      game = undoLastDart(game);
      if (!isBot(game, last.playerId)) break;
    }
    haptics.selection();
    set({ game, legPause: false });
  },
  edit: (seq, change) => {
    const { game } = get();
    if (!game) return;
    const { game: next } = editDart(game, seq, change);
    set({ game: next, legPause: false });
  },
  continueAfterLeg: () => set({ legPause: false }),
}));

/** Games whose visit totals are worth calling out. */
const CALLS_TOTALS = new Set(['x01', 'shanghai', 'countUp', 'gotcha', 'fives', 'halveIt']);

/** Caller, haptics and the leg pause after a dart. */
function announce(game: LoadedGame) {
  const visits = game.def.visits(game.state);
  const visit = visits[visits.length - 1];
  if (!visit) return;
  const t = i18n.getFixedT('en', 'game');
  const over = game.def.result(game.state) !== null;
  if (over && game.session.kind === 'drill') {
    haptics.success();
    return;
  }
  if (visit.endsLeg || over) {
    haptics.success();
    call(over && game.session.typeId === 'x01' ? t('caller.gameShotMatch') : t('caller.gameShot'));
    if (!over) useGame.setState({ legPause: true });
    return;
  }
  if (!visit.done) return;
  if (visit.bust) {
    haptics.warning();
    call(t('caller.noScore'));
    return;
  }
  if (!CALLS_TOTALS.has(game.session.typeId)) return;
  call(visit.total === 180 ? t('caller.oneEighty') : t('caller.total', { total: visit.total }));
}

/** "T20 5 1" for a visit's darts. */
export const dartsText = (hits: Hit[]) => hits.map(label).join(' ');

/** Whether the player at the oche is a bot. */
export function botUp(game: LoadedGame | null): number | null {
  if (!game) return null;
  const p = game.def.currentPlayer(game.state);
  return p?.botLevel ?? null;
}
