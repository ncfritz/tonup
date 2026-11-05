// The You page (docs/design/stats.md → Overall): every game and drill over the chosen range,
// pooled; records are all-time. Bots' darts never count toward your figures.
import {
  assessmentLevels,
  DRILL_IDS,
  type AssessedSkill,
  type AssessmentState,
  type DrillId,
} from '@/domain/drills';
import type { GameResult } from '@/domain/games';
import {
  addDays,
  days,
  doubleLadder,
  missSplit,
  rangeBounds,
  streaks,
  WEEK_DAYS,
  type MissSide,
  type StatsRange,
  type TargetRate,
} from '@/domain/stats';
import { dartsOf, finishedBetween, finishedOfType } from '@/services/db/sessionsRepo';

import { YOU_ID } from '../game/lineup';
import { loadGame, sessionX01Stats, x01StatsFor, type LoadedGame } from '../game/session';
import { allBests } from '../practice/bests';

export interface Opponent {
  key: string;
  name: string;
  botLevel?: number;
  won: number;
  lost: number;
  /** Your X01 average and theirs in matches against each other, when you played X01. */
  average: { you: number; them: number } | null;
}

export interface YouPage {
  headline: {
    darts: number;
    gamesWon: number;
    games: number;
    oneEighties: number;
    highestCheckout: number;
    bestAverage: number | null;
    streak: number;
  };
  form: {
    /** Per X01 match, oldest first. */
    averages: number[];
    first9: number[];
    checkoutRate: { first: number | null; last: number | null };
    /** Newest last: true for a win, false a loss. */
    results: boolean[];
    from: number;
  };
  doubles: { ladder: TargetRate[]; darts: number; hits: number };
  miss: { counts: Record<MissSide, number>; total: number };
  activity: {
    days: { day: number; kinds: string[] }[];
    current: number;
    longest: number;
    /** Minutes at the board per week, oldest first. */
    weeks: number[];
  };
  opponents: Opponent[];
  /** Suggests the next bot level when you beat one most of the time. */
  nextBot: { level: number; rate: number } | null;
  records: { key: string; value: number; at: number; drill?: DrillId }[];
  skills: { at: number; levels: Record<AssessedSkill, number> }[];
}

const load = (id: string): LoadedGame | null => {
  try {
    return loadGame(id);
  } catch {
    return null;
  }
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function loadYou(range: StatsRange, now = Date.now()): YouPage {
  const bounds = rangeBounds(range, now);
  const sessions = finishedBetween(bounds.from, bounds.to);
  const loaded = sessions.flatMap((s) => {
    const g = load(s.id);
    return g ? [{ s, g }] : [];
  });
  const mine = loaded.filter(({ g }) => g.session.players.some((p) => p.id === YOU_ID));
  const darts = dartsOf(
    YOU_ID,
    mine.map(({ s }) => s.id),
  );

  // Games with an opponent, for wins, results and head-to-head.
  const games = mine.filter(({ s, g }) => s.kind === 'game' && g.session.players.length > 1);
  const results = games.flatMap(({ s }) => {
    const r = s.result as GameResult | null;
    return r && r.winnerId !== null ? [r.winnerId === YOU_ID] : [];
  });

  const x01 = mine.filter(({ s }) => s.kind === 'game' && s.typeId === 'x01');
  const x01Stats = x01.map(({ g }) => sessionX01Stats(g, YOU_ID)).filter((st) => st.darts > 0);
  const rates = x01Stats.map((st) => st.checkoutRate).filter((r): r is number => r !== null);
  const third = Math.max(1, Math.floor(rates.length / 3));

  const opponents = new Map<
    string,
    Opponent & { sums: { you: number; them: number; n: number } }
  >();
  for (const { s, g } of games) {
    const r = s.result as GameResult | null;
    if (!r || r.winnerId === null) continue;
    const isX01 = s.typeId === 'x01';
    const youAvg = isX01 ? sessionX01Stats(g, YOU_ID).average : 0;
    for (const p of g.session.players) {
      if (p.id === YOU_ID) continue;
      const key = p.botLevel !== undefined ? `bot:${p.botLevel}` : p.id;
      const o = opponents.get(key) ?? {
        key,
        name: p.name,
        botLevel: p.botLevel,
        won: 0,
        lost: 0,
        average: null,
        sums: { you: 0, them: 0, n: 0 },
      };
      if (r.winnerId === YOU_ID) o.won++;
      else if (r.winnerId === p.id) o.lost++;
      if (isX01) {
        o.sums.you += youAvg;
        o.sums.them += sessionX01Stats(g, p.id).average;
        o.sums.n++;
        o.average = { you: o.sums.you / o.sums.n, them: o.sums.them / o.sums.n };
      }
      opponents.set(key, o);
    }
  }
  const list: Opponent[] = [...opponents.values()]
    .map(({ sums: _sums, ...o }) => o)
    .sort((a, b) => b.won + b.lost - (a.won + a.lost));
  const bots = list
    .filter((o) => o.botLevel !== undefined && o.won + o.lost >= 5)
    .sort((a, b) => b.botLevel! - a.botLevel!);
  const top = bots[0];
  const topRate = top ? top.won / (top.won + top.lost) : 0;
  const nextBot =
    top && top.botLevel! < 5 && topRate >= 0.7 ? { level: top.botLevel! + 1, rate: topRate } : null;

  // Activity over the range, and the practice streak over the last year.
  const calendar = days(
    loaded.map(({ s }) => ({ at: s.endedAt, kind: s.kind })),
    bounds,
  );
  const active = calendar.map((d) => d.kinds.length > 0);
  const yearBounds = { from: addDays(now, -365), to: bounds.to };
  const practice = days(
    finishedBetween(yearBounds.from, yearBounds.to, 'drill').map((s) => ({
      at: s.endedAt,
      kind: 'drill',
    })),
    yearBounds,
  ).map((d) => d.kinds.length > 0);
  const weekCount = Math.ceil(calendar.length / WEEK_DAYS);
  const weeks = Array.from({ length: weekCount }, () => 0);
  for (const { s } of loaded) {
    const index = Math.floor((s.endedAt - bounds.from) / (WEEK_DAYS * 86_400_000));
    if (index >= 0 && index < weekCount) {
      weeks[index]! += Math.max(0, s.endedAt - s.startedAt) / 60_000;
    }
  }

  const ladder = doubleLadder(darts);
  const skills = mine
    .filter(({ s }) => s.kind === 'drill' && s.typeId === 'assessment')
    .map(({ s, g }) => ({ at: s.endedAt, levels: assessmentLevels(g.state as AssessmentState) }));

  return {
    headline: {
      darts: darts.length,
      gamesWon: results.filter(Boolean).length,
      games: results.length,
      oneEighties: x01Stats.reduce((n, st) => n + st.oneEighties, 0),
      highestCheckout: Math.max(0, ...x01Stats.map((st) => st.highestCheckout)),
      bestAverage: x01Stats.length ? Math.max(...x01Stats.map((st) => st.average)) : null,
      streak: streaks(practice).current,
    },
    form: {
      averages: x01Stats.map((st) => st.average),
      first9: x01Stats.map((st) => st.first9Average),
      checkoutRate: {
        first: rates.length >= 2 ? mean(rates.slice(0, third)) : null,
        last: rates.length >= 2 ? mean(rates.slice(-third)) : null,
      },
      results: results.slice(-5),
      from: bounds.from,
    },
    doubles: {
      ladder,
      darts: ladder.reduce((n, r) => n + r.darts, 0),
      hits: ladder.reduce((n, r) => n + r.hits, 0),
    },
    miss: missSplit(darts),
    activity: {
      days: calendar,
      current: streaks(active).current,
      longest: streaks(active).longest,
      weeks: weeks.map((m) => Math.round(m)),
    },
    opponents: list,
    nextBot,
    records: records(),
    skills,
  };
}

/** Every personal best, all-time, with when it was set. */
export function records(): YouPage['records'] {
  const out: YouPage['records'] = [];
  let bestAverage: { value: number; at: number } | null = null;
  let highCheckout: { value: number; at: number } | null = null;
  let bestLeg: { value: number; at: number } | null = null;
  let most180s: { value: number; at: number } | null = null;
  for (const s of finishedOfType('game', 'x01', 1000)) {
    let st;
    try {
      st = x01StatsFor(s.id, YOU_ID);
    } catch {
      continue;
    }
    if (st.darts === 0) continue;
    if (!bestAverage || st.average > bestAverage.value)
      bestAverage = { value: st.average, at: s.endedAt };
    if (st.highestCheckout && (!highCheckout || st.highestCheckout > highCheckout.value))
      highCheckout = { value: st.highestCheckout, at: s.endedAt };
    if (st.bestLeg !== null && (!bestLeg || st.bestLeg < bestLeg.value))
      bestLeg = { value: st.bestLeg, at: s.endedAt };
    if (st.oneEighties && (!most180s || st.oneEighties > most180s.value))
      most180s = { value: st.oneEighties, at: s.endedAt };
  }
  if (bestAverage) out.push({ key: 'bestAverage', ...bestAverage });
  if (highCheckout) out.push({ key: 'highCheckout', ...highCheckout });
  if (bestLeg) out.push({ key: 'bestLeg', ...bestLeg });
  if (most180s) out.push({ key: 'most180s', ...most180s });
  const bests = allBests();
  for (const id of DRILL_IDS) {
    const b = bests[id];
    if (b) out.push({ key: 'drill', value: b.score, at: b.endedAt, drill: id });
  }
  return out;
}
