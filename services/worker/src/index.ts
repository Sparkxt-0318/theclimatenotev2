/**
 * Worker entry point.
 *
 * Run by a GitHub Actions cron every 30 minutes, and on demand from the admin
 * console's "Run now" button via repository_dispatch.
 *
 * It lives in Actions rather than a serverless function because the AI steps
 * comfortably exceed a 60-second function timeout, and because the extraction
 * and chart rendering need real npm packages rather than an edge runtime.
 */

import { loadConfig } from './config';
import { runPipeline } from './pipeline/run';

async function main(): Promise<void> {
  const started = Date.now();

  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(`Configuration error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  const summary = await runPipeline(config);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\n--- Run complete in ${seconds}s ---`);
  for (const detail of summary.details) console.log(`  ${detail}`);

  // Fail the Actions run when something broke, so a silent breakage in the
  // weekly pipeline surfaces as a red build rather than going unnoticed.
  if (summary.failed > 0) process.exit(1);
}

void main().catch((error: unknown) => {
  console.error('Unhandled failure:', error);
  process.exit(1);
});
