import pc from 'picocolors';

export async function previewCommand(targetPath: string): Promise<number> {
  console.log('Run preview with: ' + pc.cyan('pnpm --filter @proxima-io/catalog-preview dev'));
  console.log(`Template target: ${pc.dim(targetPath)}`);
  return 0;
}
