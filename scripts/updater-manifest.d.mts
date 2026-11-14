export const PLATFORMS: Record<string, string>;
export function buildManifest(input: {
  tag: string;
  notes: string;
  signatures: Record<string, string>;
  pubDate: string;
}): {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<string, { signature: string; url: string }>;
};
