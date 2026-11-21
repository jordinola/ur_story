import { render, screen } from '@testing-library/react-native';
import { HeaderLogo } from './HeaderLogo';

describe('HeaderLogo', () => {
  it('is announced as a header named after the app', async () => {
    await render(<HeaderLogo />);

    expect(screen.getByRole('header', { name: 'UR Story' })).toBeOnTheScreen();
  });

  it('shows the app name next to the icon', async () => {
    await render(<HeaderLogo />);

    expect(screen.getByText('UR Story')).toBeOnTheScreen();
  });
});
