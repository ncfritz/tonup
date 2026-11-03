// The 26 games of the rules library as engines plus presets (docs/data/game-rules.md). New game,
// Quick start, Rematch and the rules pages all start games through here.
import type { Rng } from '@/domain/bot';
import type { PlayerRef } from '@/domain/darts';
import { gameFor, type GameId } from '@/domain/games';
import { drawNumbers } from '@/domain/games/killer';

export interface Preset {
  game: GameId;
  /** Settings the game always has (its variant). The rest come from your saved settings. */
  fixed: Record<string, unknown>;
  /** Players allowed. */
  players: { min: number; max: number };
}

const ANY = { min: 1, max: 6 };
const TWO_PLUS = { min: 2, max: 6 };
const TWO = { min: 2, max: 2 };

export const PRESETS = {
  x01: { game: 'x01', fixed: {}, players: ANY },
  dido201: { game: 'x01', fixed: { startScore: 201, in: 'double', out: 'double' }, players: ANY },
  gotcha: { game: 'gotcha', fixed: {}, players: TWO_PLUS },
  fives: { game: 'fives', fixed: {}, players: ANY },
  cricket: { game: 'cricket', fixed: { variant: 'standard' }, players: ANY },
  cutThroat: { game: 'cricket', fixed: { variant: 'cutThroat' }, players: ANY },
  noScore: { game: 'cricket', fixed: { variant: 'noScore' }, players: ANY },
  tactics: { game: 'cricket', fixed: { variant: 'tactics' }, players: ANY },
  randomCricket: { game: 'cricket', fixed: { variant: 'random' }, players: ANY },
  mickeyMouse: { game: 'cricket', fixed: { variant: 'mickeyMouse' }, players: ANY },
  killerCricket: { game: 'killer', fixed: { variant: 'cricket' }, players: TWO_PLUS },
  clock: { game: 'clock', fixed: { lives: null }, players: ANY },
  nineLives: { game: 'clock', fixed: { lives: 3 }, players: ANY },
  hareHounds: { game: 'hareHounds', fixed: {}, players: TWO },
  shanghai: { game: 'shanghai', fixed: {}, players: ANY },
  halveIt: { game: 'halveIt', fixed: { list: 'halveIt' }, players: ANY },
  bermuda: { game: 'halveIt', fixed: { list: 'bermuda' }, players: ANY },
  countUp: { game: 'countUp', fixed: {}, players: ANY },
  killer: { game: 'killer', fixed: { variant: 'classic' }, players: TWO_PLUS },
  blindKiller: { game: 'killer', fixed: { variant: 'blind' }, players: TWO_PLUS },
  scam: { game: 'scam', fixed: {}, players: TWO },
  baseball: { game: 'baseball', fixed: { bullseye: false }, players: ANY },
  bullseyeBaseball: { game: 'baseball', fixed: { bullseye: true }, players: ANY },
  golf: { game: 'golf', fixed: {}, players: ANY },
  football: { game: 'football', fixed: {}, players: TWO_PLUS },
  ticTacToe: { game: 'ticTacToe', fixed: {}, players: TWO },
} as const satisfies Record<string, Preset>;

export type PresetId = keyof typeof PRESETS;

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
export const isPresetId = (v: unknown): v is PresetId => typeof v === 'string' && v in PRESETS;

/** The settings a preset plays with: the game's defaults, your saved ones, then the preset. */
export function settingsFor(id: PresetId, saved?: unknown): Record<string, unknown> {
  const p: Preset = PRESETS[id];
  return {
    ...(gameFor(p.game).defaults as Record<string, unknown>),
    ...((saved as Record<string, unknown> | undefined) ?? {}),
    ...p.fixed,
  };
}

/** Draws what a game deals at the start: Killer numbers, Random Cricket's six. */
export function deal(
  game: GameId,
  settings: Record<string, unknown>,
  players: PlayerRef[],
  rng: Rng = Math.random,
) {
  if (game === 'killer') return { ...settings, numbers: drawNumbers(players.length, rng) };
  if (game === 'cricket' && settings.variant === 'random')
    return { ...settings, numbers: drawNumbers(6, rng) };
  return settings;
}

/** Which preset a stored game's settings came from (for names and the rules link). */
export function presetOf(game: string, settings: unknown): PresetId {
  const s = (settings ?? {}) as Record<string, unknown>;
  switch (game) {
    case 'x01':
      return s.startScore === 201 && s.in === 'double' && s.out === 'double' ? 'dido201' : 'x01';
    case 'cricket':
      return (
        (
          {
            standard: 'cricket',
            cutThroat: 'cutThroat',
            noScore: 'noScore',
            tactics: 'tactics',
            random: 'randomCricket',
            mickeyMouse: 'mickeyMouse',
          } as const
        )[s.variant as string] ?? 'cricket'
      );
    case 'killer':
      return s.variant === 'cricket'
        ? 'killerCricket'
        : s.variant === 'blind'
          ? 'blindKiller'
          : 'killer';
    case 'clock':
      return s.lives ? 'nineLives' : 'clock';
    case 'halveIt':
      return s.list === 'bermuda' ? 'bermuda' : 'halveIt';
    case 'baseball':
      return s.bullseye ? 'bullseyeBaseball' : 'baseball';
    default:
      return isPresetId(game) ? game : 'x01';
  }
}
