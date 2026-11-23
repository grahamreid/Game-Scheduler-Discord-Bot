/**
 * Supplies the current time. Services depend on this small interface rather
 * than calling `new Date()` themselves, so tests can use a predictable clock.
 */
export interface Clock {
  now(): Date;
}

/** The real clock used when the bot is running normally. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
