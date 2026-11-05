import {
  betterCandidate,
  fetchModels,
  runProgress,
  type ModelScores,
  type RunDetail,
} from './labData';

jest.mock('expo-file-system', () => ({ File: class {}, UploadType: {} }));

const model = (
  id: number,
  status: ModelScores['status'],
  [visitCorrect, dartCorrect, boardFound]: (number | null)[],
): ModelScores => ({
  id,
  name: `v${id}`,
  status,
  runId: id,
  createdAt: id,
  evaluatedOn: 'verify set',
  samples: 100,
  visitCorrect: visitCorrect ?? null,
  dartCorrect: dartCorrect ?? null,
  boardFound: boardFound ?? null,
  exported: true,
});

describe('Lab tabs', () => {
  it('finds the newest candidate better than the active model on all three numbers', () => {
    const active = model(3, 'active', [0.91, 0.94, 0.985]);
    expect(
      betterCandidate([
        model(5, 'candidate', [0.95, 0.93, 0.99]),
        model(4, 'candidate', [0.93, 0.956, 0.99]),
        active,
      ]),
    )?.toMatchObject({ name: 'v4' });
    expect(betterCandidate([model(4, 'candidate', [0.93, null, 0.99]), active])).toBeNull();
  });

  it('measures a training run’s progress from finished epochs and the current step', () => {
    const d = (status: RunDetail['run']['status'], done: number, step: RunDetail['log']['step']) =>
      ({
        run: { status, stage: 'train', params: { epochs: 20 } },
        metrics: Array.from({ length: done }, (_, i) => ({ epoch: i + 1 })),
        log: { step },
      }) as unknown as RunDetail;
    expect(runProgress(d('running', 7, { epoch: 8, step: 110, of: 220 }))).toBeCloseTo(0.375);
    expect(runProgress(d('running', 7, { epoch: 7, step: 220, of: 220 }))).toBeCloseTo(0.35);
    expect(runProgress(d('done', 20, null))).toBe(1);
  });

  it('reports Lab’s error when it refuses or can’t be reached', async () => {
    const refused = (async () => ({
      ok: false,
      status: 404,
      json: async () => ({ error: 'No such model' }),
    })) as unknown as typeof fetch;
    expect(await fetchModels('mac.local:3100', refused)).toEqual({
      ok: false,
      error: 'No such model',
    });
    const down = (async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    expect(await fetchModels('mac.local:3100', down)).toEqual({
      ok: false,
      error: 'Network request failed',
    });
  });
});
