import { DEFAULT_SETTINGS, setSettingsPersistence, useSettings } from './store';

describe('settings store', () => {
  beforeEach(() => useSettings.setState(DEFAULT_SETTINGS));

  it('hydrates valid stored values and ignores the rest', () => {
    useSettings.getState().hydrate({ appearance: 'dark', haptics: 'yes', theme: 'neon', extra: 1 });
    const s = useSettings.getState();
    expect(s.appearance).toBe('dark');
    expect(s.haptics).toBe(true);
    expect(s.theme).toBe('pro');
  });

  it('writes changes through', () => {
    const writes: [string, unknown][] = [];
    setSettingsPersistence((k, v) => writes.push([k, v]));
    useSettings.getState().set('appearance', 'light');
    expect(useSettings.getState().appearance).toBe('light');
    expect(writes).toEqual([['appearance', 'light']]);
    setSettingsPersistence(() => {});
  });
});
