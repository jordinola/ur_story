/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

type AppConfig = {
  expo: {
    ios: {
      config?: { usesNonExemptEncryption?: boolean };
      privacyManifests?: {
        NSPrivacyTracking?: boolean;
        NSPrivacyTrackingDomains?: string[];
        NSPrivacyCollectedDataTypes?: unknown[];
        NSPrivacyAccessedAPITypes?: { NSPrivacyAccessedAPIType: string; NSPrivacyAccessedAPITypeReasons: string[] }[];
      };
    };
  };
};

const { ios } = (JSON.parse(readFileSync(join(__dirname, '../../app.json'), 'utf8')) as AppConfig).expo;

describe('app.json iOS privacy declarations', () => {
  it('declares that the app uses no non-exempt encryption', () => {
    expect(ios.config?.usesNonExemptEncryption).toBe(false);
  });

  it('declares no tracking and no collected data', () => {
    expect(ios.privacyManifests?.NSPrivacyTracking).toBe(false);
    expect(ios.privacyManifests?.NSPrivacyTrackingDomains).toEqual([]);
    expect(ios.privacyManifests?.NSPrivacyCollectedDataTypes).toEqual([]);
  });

  it.each([
    ['NSPrivacyAccessedAPICategoryUserDefaults', 'CA92.1'],
    ['NSPrivacyAccessedAPICategoryFileTimestamp', 'C617.1'],
  ])('declares the required reason for %s', (category, reason) => {
    const entry = ios.privacyManifests?.NSPrivacyAccessedAPITypes?.find(
      (api) => api.NSPrivacyAccessedAPIType === category,
    );

    expect(entry?.NSPrivacyAccessedAPITypeReasons).toContain(reason);
  });
});
