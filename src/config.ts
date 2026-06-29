/**
 * Dev-only overrides. Keep these `null`/off for normal builds.
 */

/**
 * Force a specific model regardless of device RAM. Useful for smoke-testing the
 * full flow on a lower-RAM device or emulator.
 *   'fallback' → always use the 3B model
 *   'primary'  → always use the 8B model
 *   null       → automatic RAM-based selection (default)
 */
export const DEV_FORCE_MODEL: 'primary' | 'fallback' | null = 'primary';
