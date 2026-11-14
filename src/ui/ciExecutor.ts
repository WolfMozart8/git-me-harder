import type { TestExecutor } from '../levels';

const WORKER_SOURCE = `
self.onmessage = (e) => {
  const { code, exprs } = e.data;
  self.postMessage(exprs.map((expr) => {
    try {
      return new Function(code + "\\n;return (" + expr + ");")() ? true : "assertion failed";
    } catch (err) {
      return String(err);
    }
  }));
};`;

const TIMEOUT_MS = 1500;

/**
 * Runs the player's code in a throwaway Web Worker, so an infinite loop
 * in a badly resolved conflict cannot freeze the page.
 */
export const workerExecutor: TestExecutor = (code, exprs) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    const worker = new Worker(url);
    const finish = (results: (true | string)[]) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(results);
    };
    const timer = setTimeout(() => finish(exprs.map(() => 'timeout: the code never finished')), TIMEOUT_MS);
    worker.onmessage = (e) => finish(e.data);
    worker.onerror = (e) => finish(exprs.map(() => e.message || 'error'));
    worker.postMessage({ code, exprs });
  });
