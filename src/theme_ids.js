/**
 * KY-Poni - Canonical Theme ID Registry
 *
 * Single source of truth for theme identity, shared by ConfigManager and ThemeManager.
 * Renamed ids must be listed here so that:
 *   - saved config.json values referencing an old id keep resolving,
 *   - legacy on-disk theme folders get migrated,
 *   - a renamed id can never silently degrade into "theme not installed".
 */

/** Legacy theme id / folder name -> current canonical id. */
const LEGACY_THEME_ID_ALIASES = {
  'cyberpunk-2077': 'cyberpunk2077',
  'undertale-box': 'undertale',
};

/**
 * Maps a legacy theme id or folder name to its canonical id.
 * Returns the input unchanged when no alias applies, so it is safe on modern ids.
 * @param {string} id
 * @returns {string}
 */
function legacyIdToCanonical(id) {
  if (!id || typeof id !== 'string') return id;
  return LEGACY_THEME_ID_ALIASES[id] || id;
}

/** True when the given id is a renamed (pre-v0.6.0) identifier. */
function isLegacyThemeId(id) {
  return Boolean(id && typeof id === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_THEME_ID_ALIASES, id));
}

module.exports = { LEGACY_THEME_ID_ALIASES, legacyIdToCanonical, isLegacyThemeId };
