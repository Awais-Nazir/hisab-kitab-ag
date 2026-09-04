/**
 * Calculates equal splits with whole integers and assigns any remainder to "Me" (the user).
 * 
 * @param totalAmount - Total amount to split
 * @param participants - List of participant IDs
 * @param selfPersonId - The ID of the current user ("Me")
 * @returns Record mapping each participant ID to their integer share amount
 */
export function calculateEqualSplits(
  totalAmount: number,
  participants: string[],
  selfPersonId?: string
): Record<string, number> {
  const n = participants.length;
  if (n === 0) return {};

  const totalInt = Math.round(totalAmount);
  const baseShare = Math.floor(totalInt / n);
  const remainder = totalInt - baseShare * n;

  const splits: Record<string, number> = {};

  // Find if selfPersonId is among the participants
  const hasSelf = selfPersonId && participants.includes(selfPersonId);

  for (const personId of participants) {
    if (hasSelf && personId === selfPersonId) {
      splits[personId] = baseShare + remainder;
    } else if (!hasSelf && personId === participants[0]) {
      // Fallback if self is not in the list: first person takes remainder
      splits[personId] = baseShare + remainder;
    } else {
      splits[personId] = baseShare;
    }
  }

  return splits;
}
