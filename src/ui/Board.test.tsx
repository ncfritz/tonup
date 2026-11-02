import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { hitAt } from '@/domain/board';
import { label } from '@/domain/darts';

import { Board } from './Board';

const touch = (x: number, y: number) => ({ nativeEvent: { locationX: x, locationY: y } });

describe('Board', () => {
  it('turns a tap into a point in board millimetres', async () => {
    const onDart = jest.fn();
    await render(<Board size={400} onDart={onDart} accessibilityLabel="Dartboard" />);
    const board = screen.getByTestId('board');
    // On a 400 pt board, 1 pt is 1 mm: the treble 20 is 103 mm above the centre.
    await act(async () => {
      fireEvent(board, 'responderGrant', touch(200, 97));
      fireEvent(board, 'responderRelease', touch(200, 97));
    });
    expect(onDart).toHaveBeenCalledTimes(1);
    const p = onDart.mock.calls[0][0];
    expect(p).toEqual({ x: 0, y: 103 });
    expect(label(hitAt(p))).toBe('T20');
  });

  it('places the dart where the finger lets go after dragging', async () => {
    const onDart = jest.fn();
    await render(<Board size={200} onDart={onDart} accessibilityLabel="Dartboard" />);
    const board = screen.getByTestId('board');
    await act(async () => {
      fireEvent(board, 'responderGrant', touch(100, 100));
      fireEvent(board, 'responderMove', touch(100, 70));
      fireEvent(board, 'responderRelease', touch(100, 70));
    });
    // 200 pt board: 1 pt is 2 mm, so 30 pt up is 60 mm: the inner single 20.
    expect(label(hitAt(onDart.mock.calls[0][0]))).toBe('20');
  });

  it('ignores a touch the system cancels', async () => {
    const onDart = jest.fn();
    await render(<Board size={200} onDart={onDart} accessibilityLabel="Dartboard" />);
    const board = screen.getByTestId('board');
    await act(async () => {
      fireEvent(board, 'responderGrant', touch(100, 100));
      fireEvent(board, 'responderTerminate', touch(100, 100));
    });
    expect(onDart).not.toHaveBeenCalled();
  });
});
