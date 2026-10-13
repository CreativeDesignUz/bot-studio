export type OwnedBot = { id: string; owner_id: string };

export function belongsToOwner(bot: OwnedBot | null | undefined, ownerId: string) {
  return Boolean(bot && bot.owner_id === ownerId);
}
