export class BudgetExhausted extends Error {
  constructor(limit: number) {
    super(`Request budget of ${limit} is spent`);
    this.name = 'BudgetExhausted';
  }
}

/**
 * A hard ceiling on outbound requests. `take()` is called before every request and throws once
 * the limit is reached, whatever the work queue still holds.
 */
export class RequestBudget {
  readonly limit: number;
  #used = 0;

  constructor(limit: number) {
    this.limit = limit;
  }

  get used(): number {
    return this.#used;
  }

  get remaining(): number {
    return this.limit - this.#used;
  }

  take(): void {
    if (this.#used >= this.limit) throw new BudgetExhausted(this.limit);
    this.#used++;
  }
}
