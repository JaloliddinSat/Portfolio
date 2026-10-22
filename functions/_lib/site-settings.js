export const SITE_SETTINGS_KEY = 'settings/site.json';

export async function readSiteSettings(bucket) {
  if (!bucket) return { asciiEnabled: false };
  const object = await bucket.get(SITE_SETTINGS_KEY);
  if (!object) return { asciiEnabled: false };
  const settings = await object.json();
  return { asciiEnabled: settings.asciiEnabled === true };
}
