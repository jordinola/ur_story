import { fireEvent, render, screen } from '@testing-library/react-native';
import { AddProfileCard } from './AddProfileCard';

describe('AddProfileCard', () => {
  it('shows the invitation copy', async () => {
    await render(<AddProfileCard onPress={jest.fn()} />);

    expect(screen.getByText('Add a kid profile')).toBeOnTheScreen();
    expect(screen.getByText('Get stories picked just for them')).toBeOnTheScreen();
  });

  it('is a labelled button that calls onPress', async () => {
    const onPress = jest.fn();
    await render(<AddProfileCard onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add a kid profile' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
