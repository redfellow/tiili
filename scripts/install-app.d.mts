export const APP_NAME: string;
export const APP_IDENTIFIER: string;
export const INSTALL_PATH: string;
export function buildArgs(): string[];
export function builtAppPath(root: string): string;
export function isPinned(persistentApps: string): boolean;
export function dockEntryXml(): string;
export function dependenciesStale(lock: string, installedLock: string | undefined): boolean;
