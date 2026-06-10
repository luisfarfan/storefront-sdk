import pc from 'picocolors';

export const sym = {
  ok:        (msg: string) => `${pc.green('✓')} ${msg}`,
  err:       (msg: string) => `${pc.red('✗')} ${msg}`,
  warn:      (msg: string) => `${pc.yellow('⚠')} ${msg}`,
  created:   (key: string, extra = '') => `  ${pc.green('+')} created    ${pc.cyan(key)}${extra}`,
  updated:   (key: string) => `  ${pc.yellow('~')} updated    ${pc.cyan(key)}`,
  unchanged: (keys: string) => `  ${pc.dim('·')} unchanged  ${pc.dim(keys)}`,
  skipped:   (key: string, reason: string) => `  ${pc.dim('·')} skipped    ${key}  ${pc.dim(`(${reason})`)}`,
  scaffolded:(key: string, sections: string) => `  ${pc.cyan('→')} scaffolded ${pc.cyan(key)} ${pc.dim(`[${sections}]`)}`,
  bullet:    (msg: string) => `  ${pc.dim('·')} ${msg}`,
  hint:      (msg: string) => `  ${pc.dim(msg)}`,
};
