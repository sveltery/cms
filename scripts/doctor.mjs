#!/usr/bin/env node
import { runDoctorCli } from '../src/lib/server/diagnostics/doctor.ts';

try { process.exitCode = await runDoctorCli(); }
catch (error) {
  process.stderr.write(`Doctor failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
