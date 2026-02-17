/* eslint-disable @typescript-eslint/no-explicit-any */

// Minimal BullMQ mock for backend Jest runs.
// We don't want integration tests to require Redis or load BullMQ's ESM deps.

type Listener = (...args: any[]) => void;

export class Queue {
  public name: string;
  public opts: any;
  private listeners: Record<string, Listener[]> = {};

  constructor(name: string, opts?: any) {
    this.name = name;
    this.opts = opts;
  }

  on(event: string, cb: Listener) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(cb);
    return this;
  }

  // Common BullMQ API surface used in some scripts.
  add() {
    return Promise.resolve({ id: "mock-job" });
  }

  close() {
    return Promise.resolve();
  }
}

export class Worker<T = any> {
  public name: string;
  public processor: any;
  public opts: any;

  constructor(name: string, processor: any, opts?: any) {
    this.name = name;
    this.processor = processor;
    this.opts = opts;
  }

  on() {
    return this;
  }

  close() {
    return Promise.resolve();
  }
}
