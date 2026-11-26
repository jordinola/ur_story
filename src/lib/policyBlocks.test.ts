import { PRIVACY_POLICY } from '../data/privacyPolicy';
import { parsePolicyBlocks } from './policyBlocks';

describe('parsePolicyBlocks', () => {
  it('turns the markdown subset into typed blocks', () => {
    const blocks = parsePolicyBlocks('# Title\n\nLast updated: today\n\n## Heading\n\nSome text\nthat wraps.\n\n- one\n- two\n');

    expect(blocks).toEqual([
      { type: 'title', text: 'Title' },
      { type: 'paragraph', text: 'Last updated: today' },
      { type: 'heading', text: 'Heading' },
      { type: 'paragraph', text: 'Some text that wraps.' },
      { type: 'bullet', text: 'one' },
      { type: 'bullet', text: 'two' },
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(parsePolicyBlocks('  \n\n')).toEqual([]);
  });

  it('leaves no markdown markup in the real policy', () => {
    const blocks = parsePolicyBlocks(PRIVACY_POLICY);

    expect(blocks.some((block) => block.type === 'heading' && block.text === 'Who we are')).toBe(true);
    expect(blocks.every((block) => !/^(#|- )/.test(block.text))).toBe(true);
  });
});
