export function readFlag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function readFlagAll(argv: string[], name: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < argv.length - 1; i++) {
    if (argv[i] === name) {
      results.push(argv[i + 1]);
    }
  }
  return results;
}

export function hasDeploymentFlags(argv: string[]): boolean {
  return ['--preview-url', '--production-url', '--build-id', '--artifact-url', '--status']
    .some((flag) => argv.includes(flag));
}

export function setFlagValue(target: Record<string, unknown>, key: string, value: string | undefined): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
