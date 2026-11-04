import { createHash } from 'node:crypto';

/** The set a session's photos belong to. `test` is the verification set: never trained on. */
export type Split = 'train' | 'val' | 'test';

/**
 * A session's split, 80/10/10 by a hash of its ID (capture-lab.md › Splits). It is the same
 * formula as `split_of` in ml/tonup_ml/data.py, so Lab and the training code always agree, and it
 * depends only on the ID, so adding data never moves a photo between sets.
 */
export function splitOf(group: string, val = 0.1, test = 0.1): Split {
  const h = parseInt(createHash('sha1').update(group).digest('hex').slice(0, 8), 16) / 0xffffffff;
  return h < test ? 'test' : h < test + val ? 'val' : 'train';
}
