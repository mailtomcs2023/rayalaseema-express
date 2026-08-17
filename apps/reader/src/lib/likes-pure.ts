// Pure list toggle for likes. Kept free of React Native imports so it can be
// unit-tested directly under `bun test`.
export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
}
