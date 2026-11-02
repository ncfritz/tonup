/** "Today", "Yesterday", a weekday within the week, otherwise a short date. */
export function dayLabel(
  at: number,
  now: number,
  words: { today: string; yesterday: string },
  locale = 'en',
): string {
  const day = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days <= 0) return words.today;
  if (days === 1) return words.yesterday;
  if (days < 7) return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(at);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(at);
}
