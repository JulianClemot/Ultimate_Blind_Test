/** Runs a task later. Lets use cases wait (e.g. a short pause before a reveal) without owning timers. */
export interface Scheduler {
  after(delayMs: number, task: () => Promise<void>): void;
}
