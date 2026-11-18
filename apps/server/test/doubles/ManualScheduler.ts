import type { Scheduler } from '../../src/application';

/** Collects scheduled tasks; the test decides when they run. */
export class ManualScheduler implements Scheduler {
  readonly scheduled: { delayMs: number; task: () => Promise<void> }[] = [];

  after(delayMs: number, task: () => Promise<void>): void {
    this.scheduled.push({ delayMs, task });
  }

  readonly recurring: { intervalMs: number; task: () => Promise<void> }[] = [];

  every(intervalMs: number, task: () => Promise<void>): void {
    this.recurring.push({ intervalMs, task });
  }

  /** Runs and clears every pending task. */
  async runAll(): Promise<void> {
    const tasks = this.scheduled.splice(0);
    for (const { task } of tasks) await task();
  }
}
