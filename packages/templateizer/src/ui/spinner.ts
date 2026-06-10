import pc from 'picocolors';
import { sym } from './sym.js';

export interface Spinner {
  update(text: string): void;
  succeed(text: string): void;
  fail(text: string): void;
  stop(): void;
}

export function createSpinner(initialText: string): Spinner {
  const isTTY = process.stderr.isTTY;
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let current = initialText;

  if (!isTTY) {
    process.stderr.write(`  ${initialText}...\n`);
    return {
      update: (t) => { current = t; process.stderr.write(`  ${t}...\n`); },
      succeed: (t) => process.stderr.write(`${sym.ok(t)}\n`),
      fail:    (t) => process.stderr.write(`${sym.err(t)}\n`),
      stop:    () => {},
    };
  }

  const interval = setInterval(() => {
    process.stderr.write(`\r${pc.cyan(frames[i % frames.length])} ${current}   `);
    i++;
  }, 80);

  const clear = () => {
    clearInterval(interval);
    process.stderr.write(`\r${' '.repeat(current.length + 6)}\r`);
  };

  return {
    update: (t) => { current = t; },
    succeed: (t) => { clear(); process.stderr.write(`${sym.ok(t)}\n`); },
    fail:    (t) => { clear(); process.stderr.write(`${sym.err(t)}\n`); },
    stop:    () => { clear(); },
  };
}
