/**
 * Centralized business rules and thresholds for Return Age and Item Age tracking.
 */

export interface ReturnClassificationRule {
  key: 'RECENT_RETURN' | 'OLD_RETURN' | 'VERY_OLD_RETURN';
  label: string;
  minDays: number;
  maxDays: number | null; // null for unbounded (31+ days)
  badgeVariant: 'success' | 'warning' | 'danger';
}

export const RETURN_AGE_THRESHOLDS = {
  RECENT_MAX_DAYS: 7,
  OLD_MAX_DAYS: 30,
};

export const RETURN_CLASSIFICATION_RULES: ReturnClassificationRule[] = [
  {
    key: 'RECENT_RETURN',
    label: 'RECENT RETURN',
    minDays: 0,
    maxDays: RETURN_AGE_THRESHOLDS.RECENT_MAX_DAYS,
    badgeVariant: 'success',
  },
  {
    key: 'OLD_RETURN',
    label: 'OLD RETURN',
    minDays: RETURN_AGE_THRESHOLDS.RECENT_MAX_DAYS + 1,
    maxDays: RETURN_AGE_THRESHOLDS.OLD_MAX_DAYS,
    badgeVariant: 'warning',
  },
  {
    key: 'VERY_OLD_RETURN',
    label: 'VERY OLD RETURN',
    minDays: RETURN_AGE_THRESHOLDS.OLD_MAX_DAYS + 1,
    maxDays: null,
    badgeVariant: 'danger',
  },
];

export const RETURN_REASONS = [
  'Unused Material',
  'Excess Material',
  'Wrong Item',
  'Damaged',
  'Replacement',
  'Work Completed',
  'Other',
] as const;

export type ReturnReason = typeof RETURN_REASONS[number];

export const ITEM_CONDITIONS = [
  'Good',
  'Damaged',
  'Partially Damaged',
  'Defective',
  'Other',
] as const;

export type ItemCondition = typeof ITEM_CONDITIONS[number];

/**
 * Returns whether an item condition is considered damaged or defective.
 * Damaged items are quarantined and NOT added to usable stock.
 */
export function isDamagedCondition(condition?: string | null): boolean {
  if (!condition) return false;
  const normalized = condition.trim().toLowerCase();
  return (
    normalized === 'damaged' ||
    normalized === 'partially damaged' ||
    normalized === 'defective'
  );
}

/**
 * Calculate difference in calendar days between return date and issue date.
 * Uses local calendar date components to avoid timezone DST / off-by-one errors.
 */
export function calculateDaysHeld(
  issueDateInput: string | Date,
  returnDateInput: string | Date
): number {
  const parseDate = (d: string | Date): { year: number; month: number; day: number } => {
    if (typeof d === 'string') {
      const datePart = d.split('T')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) {
        return {
          year: parseInt(parts[0], 10),
          month: parseInt(parts[1], 10) - 1,
          day: parseInt(parts[2], 10),
        };
      }
    }
    const dateObj = new Date(d);
    return {
      year: dateObj.getFullYear(),
      month: dateObj.getMonth(),
      day: dateObj.getDate(),
    };
  };

  const pIssue = parseDate(issueDateInput);
  const pReturn = parseDate(returnDateInput);

  const utcIssue = Date.UTC(pIssue.year, pIssue.month, pIssue.day);
  const utcReturn = Date.UTC(pReturn.year, pReturn.month, pReturn.day);

  const diffMs = utcReturn - utcIssue;
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Get classification rule based on Days Held.
 */
export function getReturnClassification(daysHeld: number): ReturnClassificationRule {
  if (daysHeld <= RETURN_AGE_THRESHOLDS.RECENT_MAX_DAYS) {
    return RETURN_CLASSIFICATION_RULES[0];
  }
  if (daysHeld <= RETURN_AGE_THRESHOLDS.OLD_MAX_DAYS) {
    return RETURN_CLASSIFICATION_RULES[1];
  }
  return RETURN_CLASSIFICATION_RULES[2];
}
