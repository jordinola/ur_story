import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { makeStory } from '../test/fixtures';
import { StoryRow } from './StoryRow';

const stories = [makeStory({ id: 'a', title: 'Story A' }), makeStory({ id: 'b', title: 'Story B' })];

describe('StoryRow', () => {
  it('renders an accessible heading and a card for each story', async () => {
    await render(
      <StoryRow title="Bedtime" stories={stories} renderCard={(s) => <Text>{s.title}</Text>} />,
    );

    expect(screen.getByRole('header', { name: 'Bedtime' })).toBeOnTheScreen();
    expect(screen.getByText('Story A')).toBeOnTheScreen();
    expect(screen.getByText('Story B')).toBeOnTheScreen();
  });

  it('scrolls horizontally without a scroll indicator', async () => {
    await render(<StoryRow title="Bedtime" stories={stories} renderCard={(s) => <Text>{s.title}</Text>} />);

    const list = screen.getByTestId('story-row-Bedtime');
    expect(list.props.horizontal).toBe(true);
    expect(list.props.showsHorizontalScrollIndicator).toBe(false);
  });
});
