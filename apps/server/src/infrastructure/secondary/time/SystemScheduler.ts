import type { Scheduler } from '../../../application';

export class SystemScheduler implements Scheduler {
  constructor(private readonly onError: (error: unknown) => void) {}

  after(delayMs: number, task: () => Promise<void>): void {
    const timer = setTimeout(() => {
      task().catch(this.onError);
    }, delayMs);
    timer.unref();
  }
}
