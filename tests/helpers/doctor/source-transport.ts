// The unchanged Source fixtures supply their original Worker contract to the
// same native inspector. This adapter grants no Native Worker runtime coverage.
import { checkDoctor as inspectDoctor, checkSchedulerWiring as inspectScheduler }
  from '../../../src/lib/server/diagnostics/doctor.ts';

const sourceWorker = {
  name: 'EmDash',
  module: '@emdash-cms/cloudflare/worker',
  factory: 'createScheduledHandler',
  exportFix: 'export { default, PluginBridge } from "@emdash-cms/cloudflare/worker";'
};
export const checkSchedulerWiring = (cwd: string) => inspectScheduler(cwd, sourceWorker);
export const checkDoctor = (cwd: string, path: string) => inspectDoctor(cwd, path, sourceWorker);
