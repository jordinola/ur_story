import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TransportIcon } from './TransportIcon';

const parts = (testID: string) => screen.queryAllByTestId(testID, { includeHiddenElements: true });
const style = (testID: string, index = 0) => StyleSheet.flatten(parts(testID)[index]?.props.style);

describe('TransportIcon', () => {
  it.each([
    ['previous', 1, 2],
    ['next', 1, 2],
    ['play', 0, 1],
    ['pause', 2, 0],
  ] as const)('draws %s with %i bars and %i triangles', async (name, bars, triangles) => {
    await render(<TransportIcon name={name} size={24} color="#123456" />);

    expect(screen.getByTestId(`transport-icon-${name}`, { includeHiddenElements: true })).toBeTruthy();
    expect(parts('transport-icon-bar')).toHaveLength(bars);
    expect(parts('transport-icon-triangle')).toHaveLength(triangles);
  });

  it('puts the bar before the triangles for previous and after them for next', async () => {
    const view = await render(<TransportIcon name="previous" size={24} color="#123456" />);
    const ids = (name: 'previous' | 'next') =>
      screen
        .getByTestId(`transport-icon-${name}`, { includeHiddenElements: true })
        .children.map((child) => (typeof child === 'string' ? child : child.props.testID));

    expect(ids('previous')).toEqual(['transport-icon-bar', 'transport-icon-triangle', 'transport-icon-triangle']);

    await view.rerender(<TransportIcon name="next" size={24} color="#123456" />);
    expect(ids('next')).toEqual(['transport-icon-triangle', 'transport-icon-triangle', 'transport-icon-bar']);
  });

  it('points previous triangles left and play/next triangles right', async () => {
    const view = await render(<TransportIcon name="previous" size={24} color="#123456" />);
    expect(style('transport-icon-triangle').borderRightColor).toBe('#123456');
    expect(style('transport-icon-triangle').borderLeftWidth ?? 0).toBe(0);

    await view.rerender(<TransportIcon name="play" size={24} color="#123456" />);
    expect(style('transport-icon-triangle').borderLeftColor).toBe('#123456');
    expect(style('transport-icon-triangle').borderRightWidth ?? 0).toBe(0);

    await view.rerender(<TransportIcon name="next" size={24} color="#123456" />);
    expect(style('transport-icon-triangle').borderLeftColor).toBe('#123456');
  });

  it('colors the bars', async () => {
    await render(<TransportIcon name="pause" size={24} color="#abcdef" />);

    expect(style('transport-icon-bar', 0).backgroundColor).toBe('#abcdef');
    expect(style('transport-icon-bar', 1).backgroundColor).toBe('#abcdef');
  });

  it('is hidden from assistive technology', async () => {
    await render(<TransportIcon name="play" size={24} color="#123456" />);

    const root = screen.getByTestId('transport-icon-play', { includeHiddenElements: true });
    expect(root.props.accessibilityElementsHidden).toBe(true);
    expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(screen.queryByTestId('transport-icon-play')).toBeNull();
  });

  it('sizes its box from the size prop', async () => {
    await render(<TransportIcon name="play" size={30} color="#123456" />);

    const box = StyleSheet.flatten(screen.getByTestId('transport-icon-play', { includeHiddenElements: true }).props.style);
    expect(box.width).toBe(30);
    expect(box.height).toBe(30);
  });

  it('stays left-to-right under RTL', async () => {
    await render(<TransportIcon name="next" size={30} color="#123456" />);

    const box = StyleSheet.flatten(screen.getByTestId('transport-icon-next', { includeHiddenElements: true }).props.style);
    expect(box.direction).toBe('ltr');
  });

  it('centers the play triangle by its centroid', async () => {
    await render(<TransportIcon name="play" size={32} color="#123456" />);

    // The row centres the triangle's margin box, so its left edge lands at (size - width + margin) / 2.
    // The centroid sits a third of the width from the flat edge and should land on the box centre (16).
    const tri = style('transport-icon-triangle');
    const width = tri.borderLeftWidth as number;
    const left = (32 - width + (tri.marginLeft as number)) / 2;
    expect(Math.abs(left + width / 3 - 16)).toBeLessThan(0.5);
  });
});
