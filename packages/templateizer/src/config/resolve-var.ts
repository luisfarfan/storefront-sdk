export function resolveVar(
  flagValue: string | undefined,
  envKey: string,
  credValue: string | undefined,
  dotenv: Record<string, string>,
  ...dotenvAliases: string[]
): string | undefined {
  return (
    flagValue ??
    process.env[envKey] ??
    credValue ??
    dotenv[envKey] ??
    dotenvAliases.reduce<string | undefined>((v, k) => v ?? dotenv[k], undefined)
  );
}
