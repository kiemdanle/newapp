import { ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';

type Status = 'open' | 'claimed' | 'handed_off' | 'completed' | 'cancelled';

const ALLOWED: Record<Status, Status[]> = {
  open: ['claimed', 'cancelled'],
  claimed: ['handed_off', 'open', 'cancelled'],
  handed_off: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: Status, to: Status): void {
  if (!canTransition(from, to)) {
    throw new AppError({
      status: 409,
      code: ERROR_CODES.GIVEAWAY_INVALID_TRANSITION,
      title: `Cannot move giveaway from ${from} to ${to}`,
    });
  }
}
