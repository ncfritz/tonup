import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { TabBar } from './TabBar';

const names = ['practice', 'history', 'index', 'rules', 'settings'];
const titles = ['Practice', 'History', 'Play', 'Rules', 'Settings'];

function props(index: number) {
  const routes = names.map((name) => ({ key: `${name}-key`, name }));
  const navigateToTab = jest.fn();
  const emit = jest.fn(() => ({ defaultPrevented: false }));
  const descriptors = Object.fromEntries(
    routes.map((r, i) => [
      r.key,
      { options: { title: titles[i], tabBarLabel: r.name === 'index' ? 'PLAY' : undefined } },
    ]),
  );
  return {
    navigateToTab,
    props: {
      state: { index, routes },
      descriptors,
      emitter: { emit },
      navigateToTab,
      insets: { top: 0, bottom: 34, left: 0, right: 0 },
    } as unknown as BottomTabBarProps,
  };
}

describe('TabBar', () => {
  it('shows the five tabs in design order with Play selected on home', async () => {
    const { props: p } = props(2);
    await render(<TabBar {...p} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.props.accessibilityLabel)).toEqual(titles);
    expect(screen.getByRole('tab', { name: 'Play' })).toBeSelected();
    expect(screen.getByText('PLAY')).toBeOnTheScreen();
  });

  it('switches tab on press, but not when pressing the current one', async () => {
    const { props: p, navigateToTab } = props(2);
    await render(<TabBar {...p} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Rules' }));
    expect(navigateToTab).toHaveBeenCalledWith('rules-key');
    navigateToTab.mockClear();
    await fireEvent.press(screen.getByRole('tab', { name: 'Play' }));
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  it('shows a screen that isn’t a tab under home, and goes home from it', async () => {
    const { props: p, navigateToTab } = props(2);
    const routes = [...p.state.routes, { key: 'photos-key', name: 'sessions/[id]' }];
    const extra = {
      ...p,
      state: { ...p.state, routes, index: routes.length - 1 },
      descriptors: { ...p.descriptors, 'photos-key': { options: { title: 'Sessions' } } },
    } as unknown as typeof p;
    await render(<TabBar {...extra} />);
    expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(titles);
    expect(screen.getByRole('tab', { name: 'Play' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Play' }));
    expect(navigateToTab).toHaveBeenCalledWith('index-key');
  });
});
