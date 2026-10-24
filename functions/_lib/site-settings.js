export const SITE_SETTINGS_KEY = 'settings/site.json';
export const DEFAULT_SITE_SETTINGS = Object.freeze({
  gridContentGlowMultiplier: 0.25,
  asciiEnabled: false,
  asciiGravityDimmingEnabled: true,
  asciiGravityDimmingMultiplier: 0.25,
  asciiRotationMultiplier: 1,
  asciiScaleMultiplier: 1,
  asciiSpawnWidth: 100,
  asciiParticleLimit: 240,
  asciiThrowCooldown: 1.5,
  asciiLightCursorStrength: 0,
  asciiLightCursorRadius: 300,
  asciiLightCursorFalloff: 2,
  asciiLightMaxVelocity: 600,
  asciiCursorStrength: 0,
  asciiCursorRadius: 300,
  asciiCursorFalloff: 2,
  asciiMaxVelocity: 600,
  asciiCursorReleaseDistance: 40,
  asciiCursorCooldown: 1,
  asciiCursorIdleTimeout: 2,
  asciiCursorEscapeNudge: 100,
});

const rules = {
  asciiThrowCooldown: { min: 0, max: 10, label: 'Post-release force cooldown' },
  asciiLightCursorStrength: { min: 0, max: 3000, label: 'Light cursor strength' },
  asciiLightCursorRadius: { min: 0, max: 2000, label: 'Light cursor radius' },
  asciiLightCursorFalloff: { min: 0.25, max: 6, label: 'Light cursor falloff' },
  asciiLightMaxVelocity: { min: 0, max: 600, label: 'Light maximum speed' },
  asciiGravityDimmingMultiplier: { min: 0, max: 1, label: 'Gravity dimming' },
  gridContentGlowMultiplier: { min: 0, max: 1, label: 'Content glow multiplier' },
  asciiRotationMultiplier: { min: 0, max: 4, label: 'Rotation multiplier' },
  asciiScaleMultiplier: { min: 0.25, max: 3, label: 'Scale multiplier' },
  asciiSpawnWidth: { choices: [20, 40, 60, 80, 100], label: 'Spawn width' },
  asciiParticleLimit: { min: 0, max: 500, integer: true, label: 'Particle count' },
  asciiCursorStrength: { min: 0, max: 3000, label: 'Cursor strength' },
  asciiCursorRadius: { min: 0, max: 2000, label: 'Cursor radius' },
  asciiCursorFalloff: { min: 0.25, max: 6, label: 'Cursor falloff' },
  asciiMaxVelocity: { min: 0, max: 600, label: 'Maximum speed' },
  asciiCursorReleaseDistance: { min: 0, max: 500, label: 'Release distance' },
  asciiCursorCooldown: { min: 0, max: 10, label: 'Attraction cooldown' },
  asciiCursorIdleTimeout: { min: 0, max: 60, label: 'Cursor idle timeout' },
  asciiCursorEscapeNudge: { min: 0, max: 600, label: 'Escape nudge' },
};
const valid = (key, value) => {
  if (key === 'asciiEnabled' || key === 'asciiGravityDimmingEnabled') return typeof value === 'boolean';
  const rule = rules[key];
  return rule && typeof value === 'number' && Number.isFinite(value) &&
    (rule.choices ? rule.choices.includes(value) : value >= rule.min && value <= rule.max) &&
    (!rule.integer || Number.isInteger(value));
};

export function normalizeSiteSettings(raw) {
  // Existing shared values initialize light settings until explicitly saved separately.
  const legacyKeys = { asciiLightCursorStrength: 'asciiCursorStrength', asciiLightCursorRadius: 'asciiCursorRadius',
    asciiLightCursorFalloff: 'asciiCursorFalloff', asciiLightMaxVelocity: 'asciiMaxVelocity' };
  return Object.fromEntries(Object.entries(DEFAULT_SITE_SETTINGS).map(([key, fallback]) =>
    [key, valid(key, raw?.[key]) ? raw[key] : valid(key, raw?.[legacyKeys[key]]) ? raw[legacyKeys[key]] : fallback]));
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
        : key === 'asciiGravityDimmingEnabled' ? 'Choose whether gravity dimming is enabled.' : 'Choose whether floating ASCII is enabled.');
    }
  }
  return raw;
}

export async function readSiteSettings(bucket) {
  if (!bucket) return { ...DEFAULT_SITE_SETTINGS };
  const object = await bucket.get(SITE_SETTINGS_KEY);
  return normalizeSiteSettings(object ? await object.json() : null);
}
