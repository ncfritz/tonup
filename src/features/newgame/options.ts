// Each game's settings as option cards for New game's second step (docs/design/screens.md →
// New game): a title, the choices, which is picked, and a line under it where one helps.
import type { PresetId } from '../game/presets';
import { bestOf, firstTo } from '../game/lineup';

type T = (key: string, options?: Record<string, unknown>) => string;
type Settings = Record<string, unknown>;

export interface OptionCard {
  key: string;
  title: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  note?: string;
}

const nums = (xs: number[]) => xs.map((n) => ({ value: String(n), label: String(n) }));

export function optionCards(
  presetId: PresetId,
  game: string,
  s: Settings,
  set: (patch: Settings) => void,
  t: T,
): { cards: OptionCard[]; notes: string[] } {
  const yesNo = (key: string, title: string): OptionCard => ({
    key,
    title,
    options: [
      { value: 'yes', label: t('newGame.yes') },
      { value: 'no', label: t('newGame.no') },
    ],
    value: s[key] ? 'yes' : 'no',
    onChange: (v) => set({ [key]: v === 'yes' }),
  });
  const pick = (key: string, title: string, options: number[], note?: string): OptionCard => ({
    key,
    title,
    options: nums(options),
    value: String(s[key]),
    onChange: (v) => set({ [key]: Number(v) }),
    note,
  });
  const ring = (key: string, title: string): OptionCard => ({
    key,
    title,
    options: [
      { value: 'any', label: t('newGame.anyRing') },
      { value: 'doubles', label: t('newGame.doublesOnly') },
      { value: 'trebles', label: t('newGame.treblesOnly') },
    ],
    value: String(s[key]),
    onChange: (v) => set({ [key]: v }),
  });
  const cards: OptionCard[] = [];
  const notes: string[] = [];
  switch (game) {
    case 'x01':
      if (presetId === 'x01') cards.push(pick('startScore', t('newGame.start'), [301, 501, 701]));
      cards.push({
        key: 'legs',
        title: t('newGame.format'),
        options: nums([1, 3, 5, 7, 9]),
        value: String(bestOf(Number(s.legs))),
        onChange: (v) => set({ legs: firstTo(Number(v)) }),
        note: t('newGame.legs', { count: bestOf(Number(s.legs)) }),
      });
      cards.push({
        key: 'sets',
        title: t('newGame.sets'),
        options: [1, 3, 5].map((n) => ({
          value: String(n),
          label: n === 1 ? t('newGame.setsOff') : t('newGame.setsOf', { count: n }),
        })),
        value: String(bestOf(Number(s.sets))),
        onChange: (v) => set({ sets: firstTo(Number(v)) }),
      });
      if (presetId === 'x01') {
        cards.push({
          key: 'out',
          title: t('newGame.out'),
          options: [
            { value: 'double', label: t('newGame.doubleOut') },
            { value: 'master', label: t('newGame.masterOut') },
            { value: 'straight', label: t('newGame.straightOut') },
          ],
          value: String(s.out),
          onChange: (v) => set({ out: v }),
        });
        cards.push({
          key: 'in',
          title: t('newGame.in'),
          options: [
            { value: 'straight', label: t('newGame.straightIn') },
            { value: 'double', label: t('newGame.doubleIn') },
            { value: 'master', label: t('newGame.masterIn') },
          ],
          value: String(s.in),
          onChange: (v) => set({ in: v }),
        });
      }
      break;
    case 'cricket':
      cards.push({
        key: 'roundLimit',
        title: t('newGame.roundLimit'),
        options: [
          { value: '10', label: '10' },
          { value: '20', label: '20' },
          { value: '0', label: t('newGame.noLimit') },
        ],
        value: String(s.roundLimit ?? 0),
        onChange: (v) => set({ roundLimit: Number(v) || null }),
      });
      if (presetId === 'randomCricket') notes.push(t('newGame.randomNumbers'));
      break;
    case 'clock':
      cards.push(ring('ring', t('newGame.clockRing')));
      cards.push(yesNo('skip', t('newGame.clockSkip')));
      cards.push(yesNo('bull', t('newGame.clockBull')));
      break;
    case 'shanghai':
      cards.push(pick('rounds', t('newGame.rounds'), [7, 10, 20]));
      cards.push(yesNo('instantWin', t('newGame.instantWin')));
      break;
    case 'killer':
      cards.push(pick('lives', t('newGame.lives'), [3, 4, 5, 6]));
      if (presetId !== 'killerCricket') {
        cards.push({
          key: 'ownDouble',
          title: t('newGame.ownDouble'),
          options: [
            { value: 'loseLife', label: t('newGame.loseLife') },
            { value: 'nothing', label: t('newGame.nothing') },
          ],
          value: String(s.ownDouble),
          onChange: (v) => set({ ownDouble: v }),
        });
      }
      notes.push(
        presetId === 'blindKiller' ? t('newGame.blindNumbers') : t('newGame.killerNumbers'),
      );
      break;
    case 'gotcha':
      cards.push(pick('target', t('newGame.target'), [201, 301, 501]));
      cards.push(yesNo('doubleOut', t('newGame.doubleOut')));
      break;
    case 'fives':
      cards.push(pick('target', t('newGame.target'), [51, 61, 71, 101]));
      break;
    case 'countUp':
      cards.push(pick('visits', t('newGame.visits'), [6, 8, 10, 12]));
      break;
    case 'hareHounds':
      cards.push(pick('headStart', t('newGame.headStart'), [3, 5, 7], t('newGame.hareFirst')));
      break;
    case 'scam':
      notes.push(t('newGame.scamRoles'));
      break;
    case 'golf':
      cards.push(pick('holes', t('newGame.holes'), [9, 18]));
      break;
    case 'football':
      cards.push(pick('goals', t('newGame.goals'), [5, 10]));
      break;
    case 'ticTacToe':
      cards.push(ring('ring', t('newGame.claim')));
      break;
  }
  return { cards, notes };
}

/** "1+", "2", "2–6": how many players a game takes. */
export const playerRange = (p: { min: number; max: number }, max: number) =>
  p.min === p.max ? String(p.min) : p.max >= max ? `${p.min}+` : `${p.min}–${p.max}`;
