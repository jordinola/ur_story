import { render, screen } from '@testing-library/react-native';
import { ModeIcon } from './ModeIcon';

describe('ModeIcon', () => {
  it.each(['shuffle', 'repeat', 'repeat-one'] as const)('renders %s and hides itself from accessibility', async (name) => {
    await render(<ModeIcon name={name} size={24} color="#000000" />);

    const icon = screen.getByTestId(`mode-icon-${name}`, { includeHiddenElements: true });
    expect(icon).toBeOnTheScreen();
    expect(icon.props.accessibilityElementsHidden).toBe(true);
    expect(icon.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('repeat-one shows the 1', async () => {
    await render(<ModeIcon name="repeat-one" size={24} color="#000000" />);
    expect(JSON.stringify(screen.toJSON())).toContain('"content":"1"');
  });

  it('repeat shows no 1', async () => {
    await render(<ModeIcon name="repeat" size={24} color="#000000" />);
    expect(JSON.stringify(screen.toJSON())).not.toContain('"content":"1"');
  });
});
