// 29 February is allowed; such birthdays are celebrated on 28 February in other years.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(month: number): number {
  return DAYS_IN_MONTH[month - 1] ?? 31;
}

export function isValidBirthday(month: number, day: number): boolean {
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(month);
}

/** Whether a stored birthday falls on the given calendar date (29 Feb → 28 Feb in non-leap years). */
export function isBirthdayOn(birthMonth: number, birthDay: number, year: number, month: number, day: number): boolean {
  if (birthMonth !== month) return false;
  if (birthDay === day) return true;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return birthMonth === 2 && birthDay === 29 && day === 28 && !leap;
}
