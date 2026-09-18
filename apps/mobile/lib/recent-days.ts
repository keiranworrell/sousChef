import { toDateInputValue } from "@souschef/shared";

/**
 * The day strip in the cook log sheet.
 *
 * The web form uses `<input type="date">`, which React Native has no equivalent
 * of. The obvious fix is `@react-native-community/datetimepicker`, and I have
 * deliberately not reached for it: it is a native module, so it costs a new
 * build to try and another to back out, and the Expo 57 upgrade already
 * demonstrated what an unnecessary native dependency does to a Gradle run.
 *
 * What it would buy is also small. You log a cook at the hob, or the evening
 * after — "Today" and "Yesterday" cover almost every real case, and a fortnight
 * covers the roast you forgot to write up. Someone backfilling a cook from
 * three months ago can do it on the web. That is a real limitation rather than
 * a hidden one, and it is written down here so the decision can be revisited
 * on purpose rather than rediscovered.
 */

export type DayOption = {
  /** yyyy-mm-dd in the device's local timezone. */
  iso: string;
  /** "Today", "Yesterday", or a short form like "Tue 16". */
  label: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * `count` days ending with today, most recent first.
 *
 * Days are stepped with `setDate`, not by subtracting 24 hours of
 * milliseconds. The arithmetic version is wrong twice a year: on the 23-hour
 * clock-change day it lands at 23:00 the day before, which is the same calendar
 * day it started from, and the strip silently shows a duplicate.
 */
export function recentDays(today: Date, count: number): DayOption[] {
  const options: DayOption[] = [];

  for (let back = 0; back < count; back += 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    options.push({
      iso: toDateInputValue(d.toISOString()),
      label:
        back === 0
          ? "Today"
          : back === 1
            ? "Yesterday"
            : `${WEEKDAYS[d.getDay()]!} ${d.getDate()}`,
    });
  }

  return options;
}

/**
 * A label for an entry's own date, which may be older than the strip.
 *
 * An entry cooked two months ago still has to render as something when its
 * edit form opens, and "Today" would be an outright lie. Falling back to the
 * full date keeps the strip honest about what it is showing.
 */
export function labelForDay(iso: string, today: Date, count: number): string {
  const known = recentDays(today, count).find((d) => d.iso === iso);
  if (known) return known.label;

  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}
