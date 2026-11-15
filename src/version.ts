/** The running tiili version, from package.json at build time (see `define` in vite.config.ts). */
export const APP_VERSION: string = __APP_VERSION__;

/**
 * Whether this is a local build rather than a release. The repository's version is 0.0.0-dev; the release workflow
 * stamps the tag's version over it (scripts/stamp-version.mjs), so only local builds carry a pre-release version.
 */
export const DEV_BUILD: boolean = APP_VERSION.includes("-");

/** The version as shown to people: "v1.2.3" for a release, "dev build" for a local build. */
export const VERSION_LABEL: string = DEV_BUILD ? "dev build" : `v${APP_VERSION}`;
