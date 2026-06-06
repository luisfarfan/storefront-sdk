export const isCI = Boolean(
  process.env.CI ||
  process.env.GITHUB_ACTIONS ||
  process.env.NO_INTERACTIVE ||
  !process.stdin.isTTY,
);
