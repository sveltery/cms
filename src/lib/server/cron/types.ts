// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole Source CronTaskTable at pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
import type { Generated } from 'kysely';
export interface CronTaskTable {
	id: string;
	plugin_id: string;
	task_name: string;
	schedule: string;
	is_oneshot: number; // 0 or 1
	data: string | null; // JSON
	next_run_at: string;
	last_run_at: string | null;
	status: string; // 'idle' | 'running'
	locked_at: string | null;
	enabled: number; // 0 or 1
	created_at: Generated<string>;
}
export interface CronTaskDatabase { _cms_cron_tasks: CronTaskTable }
