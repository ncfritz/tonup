import { dayLabel } from './when';

const words = { today: 'Today', yesterday: 'Yesterday' };
// Monday 2 November 2026, 13:00 local.
const now = new Date(2026, 10, 2, 13).getTime();

describe('dayLabel', () => {
  it('says today, yesterday, the weekday, then the date', () => {
    expect(dayLabel(new Date(2026, 10, 2, 0, 5).getTime(), now, words)).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 1, 23).getTime(), now, words)).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 9, 30, 20).getTime(), now, words)).toBe('Friday');
    expect(dayLabel(new Date(2026, 9, 20).getTime(), now, words)).toBe('Oct 20');
  });
});
