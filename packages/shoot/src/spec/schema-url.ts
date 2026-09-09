/**
 * The editor directive a generated spec opens with.
 *
 * Inlined here rather than ported from Reel's `commands/schema.ts`, which also
 * carried the whole `schema` command and, through it, a dependency on the
 * composition layer this package deliberately does not have.
 */
export const SCHEMA_URL =
  "https://raw.githubusercontent.com/smashcut/smashcut/main/schema/smashcut.schema.json";

/** `# yaml-language-server: $schema=…`, so an editor validates the spec as you type. */
export function schemaDirective(url = SCHEMA_URL): string {
  return `# yaml-language-server: $schema=${url}`;
}
