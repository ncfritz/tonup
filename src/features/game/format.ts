// How each game reads on the scoreboard and in titles (strings from game.json).
import type { TFunction } from 'i18next';

import type { ScoreboardRow, ScoreboardView, StatLine } from '@/domain/games';
import i18next from '@/i18n';
import type { RowFormat } from '@/ui/Scoreboard';

import { presetOf } from './presets';
import type { LoadedGame } from './session';

type T = TFunction<'game'>;

/** The game's name: the start score for X01, otherwise the rules library's name for its preset. */
export function gameName(_t: T, typeId: string, settings: unknown): string {
  const id = presetOf(typeId, settings);
  if (id === 'x01') return String((settings as { startScore: number }).startScore);
  return String((i18next.t as unknown as (k: string) => unknown)(`rules:games.${id}.name`));
}

/** The row format for non-X01 games; undefined keeps X01's own. */
export function rowFormat(t: T, typeId: string): ((row: ScoreboardRow) => RowFormat) | undefined {
  switch (typeId) {
    case 'clock':
      return (r) => {
        const target = r.note === 'bull' ? t('rows.bull') : r.note;
        const lives = r.lives === undefined ? '' : ` · ${t('rows.lives', { lives: r.lives })}`;
        if (r.out) {
          return { big: t('rows.killerOut'), a11y: t('rows.outA11y', { name: r.name }) };
        }
        return r.note === 'done'
          ? { big: '✓', note: t('rows.clockDone'), a11y: t('rows.clockDoneA11y', { name: r.name }) }
          : {
              big: target ?? '',
              note: t('rows.clockOn', { target }) + lives,
              a11y: t('rows.clockA11y', { name: r.name, target }) + lives,
            };
      };
    case 'hareHounds':
      return (r) => {
        const [role, n] = (r.note ?? '').split(':');
        const number = n === '25' ? t('rows.bull') : n;
        return {
          big: number ?? '',
          note: t('rows.chase', { role, number }),
          a11y: t('rows.chaseA11y', { name: r.name, role, number }),
        };
      };
    case 'scam':
      return (r) => ({
        big: String(r.score),
        note: t('rows.scam', { role: r.note }),
        a11y: t('rows.scamA11y', { name: r.name, role: r.note, score: r.score }),
      });
    case 'baseball':
      return (r) => ({
        big: String(r.score),
        a11y: t('rows.runs', { name: r.name, score: r.score }),
      });
    case 'golf':
      return (r) => ({
        big: String(r.score),
        a11y: t('rows.strokes', { name: r.name, score: r.score }),
      });
    case 'football':
      return (r) => ({
        big: String(r.score),
        note: r.note === 'ball' ? t('rows.ball') : undefined,
        a11y: t('rows.goals', {
          name: r.name,
          score: r.score,
          ball: r.note === 'ball' ? 'yes' : 'no',
        }),
      });
    case 'ticTacToe':
      return (r) => ({
        big: String(r.score),
        note: t('rows.mark', { mark: r.note }),
        a11y: t('rows.squares', { name: r.name, mark: r.note, score: r.score }),
      });
    case 'gotcha':
    case 'fives':
    case 'countUp':
    case 'halveIt':
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
