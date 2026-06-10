export type CommandHandler = (targetPath: string, argv: string[]) => Promise<number>;
