/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { PRIVACY_CONTACT_EMAIL, PRIVACY_POLICY, PRIVACY_SUMMARY } from './privacyPolicy';

const markdown = readFileSync(join(__dirname, '../../docs/privacy-policy.md'), 'utf8');

describe('privacy policy', () => {
  it('matches the published markdown file exactly', () => {
    expect(PRIVACY_POLICY.trim()).toBe(markdown.trim());
  });

  it('names the contact email', () => {
    expect(PRIVACY_CONTACT_EMAIL).toBe('jjob3011@gmail.com');
    expect(PRIVACY_POLICY).toContain('jjob3011@gmail.com');
  });

  it('discloses that Cloudflare can see the IP address', () => {
    expect(PRIVACY_POLICY).toContain('Cloudflare');
    expect(PRIVACY_POLICY).toContain('IP address');
  });

  it('has a summary of at least four non-empty bullets', () => {
    expect(PRIVACY_SUMMARY.length).toBeGreaterThanOrEqual(4);
    expect(PRIVACY_SUMMARY.every((line) => line.trim().length > 0)).toBe(true);
  });
});
