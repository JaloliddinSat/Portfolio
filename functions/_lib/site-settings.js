export const SITE_SETTINGS_KEY = 'settings/site.json';
export const DEFAULT_SITE_SETTINGS = Object.freeze({
  asciiEnabled: false,
  asciiRotationMultiplier: 1,
  asciiScaleMultiplier: 1,
  asciiSpawnWidth: 100,
  asciiParticleLimit: 240,
  asciiCursorStrength: 0,
  asciiCursorRadius: 300,
  asciiCursorFalloff: 2,
  asciiMaxVelocity: 600,
});

const rules = {
  asciiRotationMultiplier: { min: 0, max: 4, label: 'Rotation multiplier' },
  asciiScaleMultiplier: { min: 0.25, max: 3, label: 'Scale multiplier' },
  asciiSpawnWidth: { choices: [20, 40, 60, 80, 100], label: 'Spawn width' },
  asciiParticleLimit: { min: 0, max: 500, integer: true, label: 'Particle count' },
  asciiCursorStrength: { min: 0, max: 3000, label: 'Cursor strength' },
  asciiCursorRadius: { min: 0, max: 2000, label: 'Cursor radius' },
  asciiCursorFalloff: { min: 0.25, max: 6, label: 'Cursor falloff' },
  asciiMaxVelocity: { min: 0, max: 600, label: 'Maximum speed' },
};
const valid = (key, value) => {
  if (key === 'asciiEnabled') return typeof value === 'boolean';
  const rule = rules[key];
  return rule && typeof value === 'number' && Number.isFinite(value) &&
    (rule.choices ? rule.choices.includes(value) : value >= rule.min && value <= rule.max) &&
    (!rule.integer || Number.isInteger(value));
};

export function normalizeSiteSettings(raw) {
  return Object.fromEntries(Object.entries(DEFAULT_SITE_SETTINGS).map(([key, fallback]) =>
    [key, valid(key, raw?.[key]) ? raw[key] : fallback]));
}

export function validateSiteSettingsPatch(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Object.keys(raw).length) {
    throw new Error('Provide at least one site setting.');
  }
  for (const [key, value] of Object.entries(raw)) {
    if (!Object.hasOwn(DEFAULT_SITE_SETTINGS, key)) throw new Error('Unknown site setting.');
    if (!valid(key, value)) {
      const rule = rules[key];
      throw new Error(rule
        ? `${rule.label} must be ${rule.choices ? '20, 40, 60, 80, or 100 percent' : `${rule.integer ? 'a whole number ' : ''}between ${rule.min} and ${rule.max}`}.`
        : 'Choose whether floating ASCII is enabled.');
    }
  }
  return raw;
}

export async function readSiteSettings(bucket) {
  if (!bucket) return { ...DEFAULT_SITE_SETTINGS };
  const object = await bucket.get(SITE_SETTINGS_KEY);
  return normalizeSiteSettings(object ? await object.json() : null);
}
