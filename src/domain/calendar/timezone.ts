/** IANA timezone helpers. No system-local Date assumptions. */

export interface CivilParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  offsetMinutes: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'shortOffset',
    });
    formatterCache.set(timezone, f);
  }
  return f;
}

function parseOffset(text: string): number {
  const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(text);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** 將 UTC epoch 轉為指定 IANA 時區的民用鐘面時間（含當日 DST offset）。 */
export function civilParts(instantMs: number, timezone: string): CivilParts {
  const parts = formatter(timezone).formatToParts(new Date(instantMs));
  const get = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
    offsetMinutes: parseOffset(tz),
  };
}

export type CivilInput = Pick<CivilParts, 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'>;

export type CivilResolve =
  | { status: 'ok'; instantMs: number; offsetMinutes: number }
  | { status: 'ambiguous'; options: Array<{ instantMs: number; offsetMinutes: number }> }
  | { status: 'nonexistent'; reason: string };

/**
 * 民用時間 → UTC instant。DST 重複時間回傳兩個 offset 讓使用者選；
 * 不存在的時間回傳 nonexistent，绝不默默挪动。
 */
export function resolveCivilInput(
  input: CivilInput,
  timezone: string,
  preferredOffsetMinutes?: number,
): CivilResolve {
  const naive = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, input.second);
  const offsets = new Set<number>();
  for (const probe of [naive - 36 * 3600_000, naive, naive + 36 * 3600_000]) {
    offsets.add(civilParts(probe, timezone).offsetMinutes);
  }
  if (preferredOffsetMinutes !== undefined) offsets.add(preferredOffsetMinutes);

  const options: Array<{ instantMs: number; offsetMinutes: number }> = [];
  for (const offset of offsets) {
    const instantMs = naive - offset * 60_000;
    const back = civilParts(instantMs, timezone);
    if (
      back.year === input.year && back.month === input.month && back.day === input.day &&
      back.hour === input.hour && back.minute === input.minute && back.second === input.second
    ) {
      if (!options.some((o) => o.instantMs === instantMs)) {
        options.push({ instantMs, offsetMinutes: offset });
      }
    }
  }
  options.sort((a, b) => a.offsetMinutes - b.offsetMinutes);

  if (options.length === 0) {
    return { status: 'nonexistent', reason: '該民用時間在此時區不存在（夏令時間跳時）。請改選其他時間。' };
  }
  if (options.length === 1) return { status: 'ok', ...options[0]! };
  if (preferredOffsetMinutes !== undefined) {
    const picked = options.find((o) => o.offsetMinutes === preferredOffsetMinutes);
    if (picked) return { status: 'ok', ...picked };
  }
  return { status: 'ambiguous', options };
}

/** UTC offset 的文字標示，例如 UTC+08:00。 */
export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
