export type PolicyBlock = { type: 'title' | 'heading' | 'paragraph' | 'bullet'; text: string };

/** Reads the small markdown subset docs/privacy-policy.md uses, so the app shows no raw markup. */
export function parsePolicyBlocks(markdown: string): PolicyBlock[] {
  const blocks: PolicyBlock[] = [];
  let paragraph: string[] = [];

  const endParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    if (line === '') endParagraph();
    else if (line.startsWith('## ')) {
      endParagraph();
      blocks.push({ type: 'heading', text: line.slice(3) });
    } else if (line.startsWith('# ')) {
      endParagraph();
      blocks.push({ type: 'title', text: line.slice(2) });
    } else if (line.startsWith('- ')) {
      endParagraph();
      blocks.push({ type: 'bullet', text: line.slice(2) });
    } else paragraph.push(line);
  }
  endParagraph();
  return blocks;
}
