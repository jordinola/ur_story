import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Alert } from 'react-native';
import type { Profile } from '../types';
import { ProfileForm } from './ProfileForm';

const mia: Profile = { id: 'a', name: 'Mia', age: 5, tags: ['Space'], languages: ['en'], color: '#B91C1C' };

const setup = async (props: Partial<React.ComponentProps<typeof ProfileForm>> = {}) => {
  const onSubmit = jest.fn();
  await render(<ProfileForm submitLabel="Save" onSubmit={onSubmit} {...props} />);
  return { onSubmit };
};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('ProfileForm', () => {
  it('blocks a blank or whitespace-only name and explains why', async () => {
    const { onSubmit } = await setup();
    await fireEvent.changeText(screen.getByLabelText('Name'), '   ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a name')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the keyboard from suggesting the parent\'s own name or contact details', async () => {
    await setup();
    const input = screen.getByLabelText('Name');
    expect(input.props.autoComplete).toBe('off');
    expect(input.props.textContentType).toBe('none');
  });

  it('limits the name input to 20 characters and still validates longer values', async () => {
    const { onSubmit } = await setup();
    expect(screen.getByLabelText('Name').props.maxLength).toBe(20);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'a'.repeat(21));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Use 20 characters or fewer')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('bounds the age stepper at 2 and 12', async () => {
    await setup({ initial: { ...mia, age: 2 } });
    expect(screen.getByRole('button', { name: 'Decrease age' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Increase age' }));
    expect(screen.getByText('3')).toBeOnTheScreen();
  });

  it('disables increase at 12', async () => {
    await setup({ initial: { ...mia, age: 12 } });
    expect(screen.getByRole('button', { name: 'Increase age' })).toBeDisabled();
  });

  it.each([1, 13])('rejects an out-of-range saved age of %i', async (age) => {
    const { onSubmit } = await setup({ initial: { ...mia, age } });
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Age must be a whole number from 2 to 12')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires at least one language', async () => {
    const { onSubmit } = await setup({ initial: mia });
    await fireEvent.press(screen.getByRole('button', { name: 'English' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Pick at least one language')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('announces the first validation error to VoiceOver and marks errors as alerts', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    await setup();
    await fireEvent.changeText(screen.getByLabelText('Name'), ' ');
    await fireEvent.press(screen.getByRole('button', { name: 'English' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Enter a name');
    expect(screen.getByRole('alert', { name: 'Enter a name' })).toBeOnTheScreen();
    expect(screen.getByRole('alert', { name: 'Pick at least one language' })).toBeOnTheScreen();
  });

  it('does not announce anything on a valid submit', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    await setup({ initial: mia });
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(announce).not.toHaveBeenCalled();
  });

  it('submits a trimmed name with the chosen values', async () => {
    const { onSubmit } = await setup();
    await fireEvent.changeText(screen.getByLabelText('Name'), '  Zoe ');
    await fireEvent.press(screen.getByRole('button', { name: 'Increase age' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Space' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Español' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Zoe', age: 6, tags: ['Space'], languages: ['en', 'es'] }),
    );
  });

  it('toggles tag chips with selected state', async () => {
    await setup();
    const chip = screen.getByRole('button', { name: 'Magic' });
    expect(chip).not.toBeSelected();
    await fireEvent.press(chip);
    expect(screen.getByRole('button', { name: 'Magic' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Magic' }));
    expect(screen.getByRole('button', { name: 'Magic' })).not.toBeSelected();
  });

  it('names each color swatch', async () => {
    await setup();
    for (const name of ['Blue', 'Red', 'Green', 'Purple', 'Orange', 'Teal']) {
      expect(screen.getByRole('button', { name })).toBeOnTheScreen();
    }
  });

  it('picks a color swatch', async () => {
    const { onSubmit } = await setup({ initial: mia });
    await fireEvent.press(screen.getByRole('button', { name: 'Green' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ color: '#047857' }));
  });

  it('is prefilled in edit mode and offers Delete only when onDelete is given', async () => {
    await setup({ initial: mia, onDelete: jest.fn() });
    expect(screen.getByLabelText('Name').props.value).toBe('Mia');
    expect(screen.getByText('5')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Space' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Delete profile' })).toBeOnTheScreen();
  });

  it('has no Delete when creating', async () => {
    await setup();
    expect(screen.queryByRole('button', { name: 'Delete profile' })).toBeNull();
  });

  it('asks for confirmation naming the kid before deleting', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onDelete = jest.fn();
    await setup({ initial: mia, onDelete });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete profile' }));
    expect(onDelete).not.toHaveBeenCalled();
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toContain('Mia');
    expect(message).toMatch(/favorites and progress/i);
    buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('disables everything when disabled', async () => {
    const { onSubmit } = await setup({ initial: mia, onDelete: jest.fn(), disabled: true });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete profile' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
