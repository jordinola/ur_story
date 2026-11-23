import { render, screen } from '@testing-library/react-native';
import { colors } from '../theme';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('shows the initials of the name', async () => {
    await render(<Avatar name="mia lopez" color="#1D4ED8" />);

    expect(screen.getByText('ML', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('shows a person glyph when there is no name', async () => {
    await render(<Avatar />);

    expect(screen.getByTestId('avatar-glyph', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('uses a neutral muted circle, not a kid color, when there is no profile', async () => {
    await render(<Avatar />);

    expect(screen.getByTestId('avatar', { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: colors.muted,
    });
  });

  it('uses the given color and size', async () => {
    await render(<Avatar name="Mia" color="#1D4ED8" size={60} />);

    expect(screen.getByTestId('avatar', { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: '#1D4ED8',
      width: 60,
      height: 60,
    });
  });
});
