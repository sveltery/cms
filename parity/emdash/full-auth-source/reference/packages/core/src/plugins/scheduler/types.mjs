/**
 * Platform-specific cron scheduler interface.
 *
 * Schedulers are responsible for calling CronExecutor.tick() at the right
 * time. The executor handles all business logic; the scheduler only manages
 * timing.
 *
 * Implementations receive the CronExecutor via constructor.
 *
 */
export {};
