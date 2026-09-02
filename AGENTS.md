<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Production Safety Rules

The main branch controls the ProTech production deployment.

Never perform any of the following without explicit user authorization in the current conversation:

- Commit while checked out on main
- Push directly to main
- Merge a pull request targeting main
- Run `gh pr merge` for a pull request targeting main
- Run `vercel --prod`
- Run `vercel promote`
- Force-push any branch
- Use `git reset --hard`
- Bypass Git hooks using `--no-verify`
- Disable, modify, or bypass `.githooks`

All development must start from develop or a feature branch.

Normal workflow:

feature/* → develop → user-reviewed PR → main

When work is ready for production, stop and ask the user to review and manually merge the develop-to-main pull request through GitHub.

Before any protected operation listed above, stop, explain which operation is being requested, and ask the user to answer **YES** or **NO**. Proceed only after the user explicitly answers **YES** in the current conversation. Any other response, prior approval, or implied approval is not authorization.

### Supabase and Database Safety

The Supabase environments are:

- Development: `crm-dev` — project reference `bfsorhjuivyqlvqrkwgn`
- Production: `crm-prod` — project reference `lnybnkbetjjluhpspvjy`

Before running any Supabase or database operation—including reads, SQL queries, migrations, schema changes, seed operations, database resets, restores, backups, Auth changes, Storage changes, Edge Function changes, or commands that link or target a Supabase project—stop and verify the actual target project reference.

Then tell the user:

1. Whether the resolved target is `crm-dev` or `crm-prod`
2. The exact project reference
3. The exact command or operation to be executed
4. Whether the operation is read-only, mutating, destructive, or production-impacting

Ask the user to answer **YES** or **NO**. Execute the operation only after the user explicitly answers **YES** in the current conversation. A prior approval does not authorize another database operation. If the project reference cannot be verified, do not execute the operation.

Never assume that a local checkout, environment variable, linked Supabase project, branch name, or displayed project name points to the intended environment. Verify the project reference before requesting permission and again immediately before execution.

### Vercel Production Safety

The Vercel production deployment is the `avyuktacrm/avyukta-crm` project, deployed from `main` to `https://protech.avyukta.ca`.

Before any Vercel operation that targets or can affect Production—including production deployments, promotions, rollbacks, aliases, domains, environment variables, project settings, or deletion of production resources—stop and tell the user:

1. The exact Vercel project and environment being targeted
2. The exact command or operation to be executed
3. The expected production impact

Ask the user to answer **YES** or **NO**. Execute the operation only after the user explicitly answers **YES** in the current conversation. A prior approval does not authorize another Vercel production operation. If the target project or environment cannot be verified, do not execute the operation.
