import { act } from '@testing-library/react-native';
import { router, Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import i18next from '@/i18n';
import capture from '@/i18n/locales/en/capture.json';

import HomeStack from '../../capture-app/(tabs)/(home)/_layout';
import CaptureTabs from '../../capture-app/(tabs)/_layout';
import RunsStack from '../../capture-app/(tabs)/runs/_layout';

i18next.addResourceBundle('en', 'capture', capture);

// Capture's real tab and stack layouts, with stand-ins for the screens: a session's photos and
// a run open over their tab (a tab hidden with `href: null` couldn't be navigated to).
it('opens a session’s photos and a run over their tabs, and back', async () => {
  const screen = (name: string) => {
    const Stand = () => <Text>{name}</Text>;
    Stand.displayName = name;
    return Stand;
  };
  const r = await renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      '(tabs)/_layout': CaptureTabs,
      '(tabs)/(home)/_layout': HomeStack,
      '(tabs)/(home)/index': screen('SESSIONS'),
      '(tabs)/(home)/sessions/[id]': screen('SESSION PHOTOS'),
      '(tabs)/runs/_layout': RunsStack,
      '(tabs)/runs/index': screen('RUNS'),
      '(tabs)/runs/[id]': screen('A RUN'),
      '(tabs)/overview': screen('OVERVIEW'),
      '(tabs)/models': screen('MODELS'),
      '(tabs)/settings': screen('SETTINGS'),
    },
    { initialUrl: '/' },
  );
  const showing = (name: string) => JSON.stringify(r.toJSON()).includes(`"${name}"`);
  expect(r.getPathname()).toBe('/');
  await act(() => router.push('/sessions/sess-1'));
  expect(r.getPathname()).toBe('/sessions/sess-1');
  expect(showing('SESSION PHOTOS')).toBe(true);
  await act(() => router.push('/runs'));
  await act(() => router.push('/runs/12'));
  expect(r.getPathname()).toBe('/runs/12');
  expect(showing('A RUN')).toBe(true);
  // The tab bar is still there, on Runs.
  expect(r.getByRole('tab', { name: 'Runs' })).toBeSelected();
  await act(() => router.back());
  expect(r.getPathname()).toBe('/runs');
});
