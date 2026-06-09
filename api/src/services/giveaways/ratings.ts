interface GiveawayParties {
  giverUserId: string;
  selectedRecipientId: string | null;
}

export interface RaterRole {
  role: 'giver' | 'recipient';
  rateeUserId: string;
}

export function inferRaterRole(g: GiveawayParties, raterUserId: string): RaterRole | null {
  if (raterUserId === g.giverUserId && g.selectedRecipientId) {
    return { role: 'giver', rateeUserId: g.selectedRecipientId };
  }
  if (g.selectedRecipientId && raterUserId === g.selectedRecipientId) {
    return { role: 'recipient', rateeUserId: g.giverUserId };
  }
  return null;
}
