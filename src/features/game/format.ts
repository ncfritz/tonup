// How each game reads on the scoreboard and in titles (strings from game.json).
import type { TFunction } from 'i18next';

import type { ScoreboardRow, ScoreboardView, StatLine } from '@/domain/games';
import type { CricketSettings } from '@/domain/games/cricket';
import type { RowFormat } from '@/ui/Scoreboard';

import type { LoadedGame } from './session';

type T = TFunction<'game'>;

/** The game's name, with the variant where it matters. */
export function gameName(t: T, typeId: string, settings: unknown): string {
  if (typeId === 'x01') return String((settings as { startScore: number }).startScore);
  if (typeId === 'cricket' && (settings as CricketSettings).variant === 'cutThroat') {
    return t('games.cutThroat');
  }
  return t(`games.${typeId}` as 'games.x01');
}

/** The row format for non-X01 games; undefined keeps X01's own. */
export function rowFormat(t: T, typeId: string): ((row: ScoreboardRow) => RowFormat) | undefined {
  switch (typeId) {
    case 'clock':
      return (r) => {
        const target = r.note === 'bull' ? t('rows.bull') : r.note;
        return r.note === 'done'
          ? { big: '✓', note: t('rows.clockDone'), a11y: t('rows.clockDoneA11y', { name: r.name }) }
          : {
              big: target ?? '',
              note: t('rows.clockOn', { target }),
              a11y: t('rows.clockA11y', { name: r.name, target }),
            };
      };
    case 'shanghai':
    case 'cricket':
      return (r) => ({
        big: String(r.score),
        a11y: t('rows.points', { name: r.name, score: r.score }),
      });
    case 'killer':
      return (r) => {
        const [number, k] = (r.note ?? '').split(' ');
        const killer = k === 'K' ? 'yes' : 'no';
        return {
          big: r.out ? t('rows.killerOut') : '●'.repeat(r.score),
          note: t('rows.killerNote', { number, killer }),
          a11y: t('rows.livesA11y', { name: r.name, number, lives: r.score, killer }),
        };
      };
    default:
      return undefined;
  }
}

/** The header line: "501 · Best of 5 legs · Leg 2", "Shanghai · Round 3 of 7"… */
export function headerTitle(t: T, game: LoadedGame, view: ScoreboardView): string {
  const name = gameName(t, game.session.typeId, game.session.settings);
  if (view.round) return t('header.titleRound', { game: name, n: view.round.n, of: view.round.of });
  return t('header.titleGame', { game: name });
}

/** A summary value as text: "72.4", "38%", "—". */
export function formatStat(line: StatLine): string {
  if (line.value === null) return '—';
  if (line.format === 'pct') return `${Math.round(line.value * 100)}%`;
  if (line.format === 'one') return line.value.toFixed(1);
  return String(Math.round(line.value));
}
