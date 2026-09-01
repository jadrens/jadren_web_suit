# Deployment scripts

Place temporary deployment tasks in this directory. Files ending in `.ts`,
`.js`, or `.sh` run automatically in filename order during deployment.

Use numeric prefixes when ordering matters, for example `010-backfill.ts`.
Scripts must be safe to retry because a failed deployment may run them again.
After a one-time task has deployed successfully, delete it in a later commit.

Deployment scripts run after `database/schema.sql` is applied and before the
web service restarts. Keep `database/schema.sql` updated with the final schema
so a fresh installation never depends on deleted one-time scripts.
