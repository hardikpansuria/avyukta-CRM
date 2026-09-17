# Source Control and Production Release Safety

Last reviewed: 2026-09-04

This is the durable reference for protecting `main` and releasing Avyukta CRM to Production. It records the 2026-09-04 incident, the controls changed that day, the intended release workflow, and safe diagnostic and recovery commands.

Do not record passwords, token values, API keys, personal IP addresses, or other secrets in this file. This repository is publicly readable.

## 1. Production mental model

The source-control gate and the production-release gate are separate:

```text
feature/*
    |
    | pull request and development review
    v
develop
    |
    | user-reviewed pull request; never a direct push
    v
main  <-- GitHub ruleset blocks direct updates
    |
    | Vercel creates a Production build
    v
Staged deployment  <-- no production domain assigned automatically
    |
    | Hardik inspects and manually selects Promote to Production
    v
https://protech.avyukta.ca
```

The three safety boundaries are:

| Boundary | Purpose | Failure it prevents |
| --- | --- | --- |
| GitHub App/token repository scope | Gives each external tool access only to explicitly required repositories | A tool for another project writing to Avyukta CRM |
| GitHub `Protect main` ruleset | Requires changes to enter `main` through a pull request | Direct web, API, Git, or integration commits to `main` |
| Vercel staged Production deployments | Requires a manual promotion before the production domain changes | An unreviewed `main` commit immediately becoming customer-facing |

No single boundary is sufficient. A GitHub ruleset controls Git history but does not decide which Vercel deployment is live. Vercel staging controls the production domain but does not remove a bad Git commit.

## 2. What happened on 2026-09-04

Unexpected commit:

```text
1801b235d526d919a3b5bc6737ebb5f6bad39064
Updated package-lock.json
```

Verified facts:

- The commit was placed directly on `main`; GitHub reported no associated pull request.
- GitHub attributed the author to `hardikpansuria` and used GitHub's `web-flow` committer/signing service.
- The Verified badge used GitHub's signing key. It did not prove that Hardik personally clicked Commit.
- Only `package-lock.json` changed: 1,367 insertions and 8,524 deletions.
- The replacement was a stale historical lockfile originally added in July 2026. It did not contain a newly injected application source file.
- The lockfile no longer matched the current `package.json` dependency set.
- Vercel reported the resulting deployment as successfully completed.
- `develop` was unaffected and retained the correct lockfile.
- The repository had no `.github/workflows` directory, so an existing GitHub Actions workflow was not the source.

Most likely cause:

- An older Bolt/StackBlitz workspace was connected to `avyukta-CRM`.
- At the incident time, the Bolt GitHub App had repository code write permission and broad repository access.
- Bolt's OAuth authorization was refreshed close to the commit time.
- The stale historical file is consistent with an old workspace synchronizing its copy through GitHub's server-side API.

This is a high-confidence explanation, although the public commit object does not contain the initiating client or IP address.

## 3. Containment changes made on 2026-09-04

Confirmed by Hardik:

- The Bolt.new GitHub App was changed to **Only select repositories**, with only `2ndBrain` selected.
- The fine-grained token used for the 2ndBrain project was changed to selected-repository access and no longer includes `avyukta-CRM`.
- A GitHub ruleset named `Protect main` was created with enforcement status **Active**.
- The ruleset bypass list is empty.
- The ruleset target was narrowed to the default branch, resolving to one target: `main`.

Still verify in the dashboards:

- [ ] In `Protect main`, confirm the target change was saved; the setup screen previously displayed a pending-save message.
- [ ] Confirm **Restrict deletions** is enabled.
- [ ] Confirm **Require a pull request before merging** is enabled with zero approvals for the solo-maintainer workflow.
- [ ] Confirm **Require conversation resolution before merging** is enabled.
- [ ] Confirm **Block force pushes** is enabled.
- [ ] Confirm **Restrict updates** is disabled; with an empty bypass list it could block all legitimate updates.
- [ ] Disconnect the old Bolt workspace from `avyukta-CRM` after preserving any useful activity evidence.
- [ ] Reduce or recreate the 2ndBrain token with only the minimum required permissions and a short expiration.
- [ ] Confirm the unexpected commit has been safely reverted through a reviewed pull request.
- [ ] Confirm Production no longer serves the deployment created from `1801b23`.

## 4. GitHub `Protect main` configuration

Dashboard path:

```text
GitHub repository
  -> Settings
  -> Rules
  -> Rulesets
  -> Protect main
```

Required configuration:

```text
Ruleset name:       Protect main
Enforcement:        Active
Bypass list:        Empty
Target:             Default branch (main only)
Expected targets:   1
```

Enable:

- Restrict deletions
- Require a pull request before merging
  - Required approvals: `0` while there is only one maintainer
  - Require conversation resolution before merging
  - Allowed merge methods: Merge and Squash
- Block force pushes

Leave disabled unless the workflow is deliberately changed and tested:

- Restrict creations
- Restrict updates
- Require linear history
- Require deployments to succeed
- Require signed commits
- Require status checks to pass
- Code scanning, code quality, and coverage gates
- Automatic Copilot review

Why approvals are zero: GitHub does not allow a pull-request author to approve their own pull request. Requiring one approval can lock out a solo maintainer. The pull request still creates a visible review checkpoint, and Vercel's manual promotion is the final human Production gate.

Why signed commits are not the primary defense: GitHub automatically signed the incident commit with its `web-flow` key, so a signed-commit requirement alone would not have blocked it.

## 5. Vercel manual Production gate

Target:

```text
Vercel project:     avyuktacrm/avyukta-crm
Environment:        Production
Production branch:  main
Production domain:  https://protech.avyukta.ca
```

Dashboard path:

```text
Vercel dashboard
  -> avyuktacrm/avyukta-crm
  -> Settings
  -> Environments
  -> Production
  -> Branch Tracking
  -> Auto-assign Custom Production Domains: OFF
```

Expected behavior after this is enabled:

1. A reviewed pull request is merged into `main`.
2. Vercel builds using the Production environment.
3. The deployment is marked **Staged**.
4. `protech.avyukta.ca` continues serving the existing Current deployment.
5. Hardik inspects and tests the staged deployment.
6. Hardik opens the deployment's `...` menu and selects **Promote to Production**.
7. Only then does the production domain move to the new deployment.

Status on 2026-09-04:

- [ ] Enabling **Auto-assign Custom Production Domains: OFF** has not yet been confirmed in this runbook.

Important: Vercel does not present a merge-time approval prompt. Turning off automatic domain assignment creates the equivalent release gate: builds can complete, but they cannot become Current until manually promoted.

## 6. Normal development and release procedure

Workspace:

```bash
cd /Users/hardik/Documents/Avyukta-CRM/crm-protech
```

Start work from the latest `develop`:

```bash
git status --short --branch
git switch develop
git pull --ff-only origin develop
git switch -c feature/<short-description>
```

Before committing:

```bash
npm ci
npm run lint
npm test
npm run build
git diff --check
git status --short
```

Do not bypass a failed check. The production build can also require approved environment configuration; resolve the real cause instead of weakening the check.

Commit and publish only the feature branch:

```bash
git add <reviewed-files>
git commit -m "<clear description>"
git push -u origin feature/<short-description>
```

Then:

1. Open a pull request from `feature/<short-description>` to `develop`.
2. Review the diff and Preview deployment.
3. Merge into `develop` only after checks pass.
4. When the complete release is ready, open a pull request from `develop` to `main`.
5. Review the exact `develop...main` diff and manually merge through GitHub.
6. Confirm Vercel produced a **Staged** Production deployment.
7. Inspect and smoke-test the staged deployment.
8. Manually promote it to Production.
9. Verify `protech.avyukta.ca` and record the released commit/deployment.

## 7. Pre-promotion checklist

Before selecting **Promote to Production**:

- [ ] The `develop` to `main` pull request was intentionally reviewed and merged.
- [ ] The staged deployment references the expected Git commit SHA.
- [ ] The build completed successfully.
- [ ] `npm run lint`, `npm test`, and `npm run build` passed for the release.
- [ ] The staged URL loads and critical authenticated flows work.
- [ ] No unexpected dependency or lockfile change is present.
- [ ] Production database operations, if any, received separate current-conversation approval and target verification.
- [ ] A known-good deployment is available for rollback.

## 8. Incident investigation commands

These commands are read-only:

```bash
git status --short --branch
git fetch origin
git show --no-patch --pretty=fuller <commit-sha>
git show --stat --oneline <commit-sha>
git diff <commit-sha>^ <commit-sha>
git branch -a --contains <commit-sha>
git log --all --oneline --decorate --since="24 hours ago"
```

Compare the dependency manifest and lockfile root:

```bash
git show <commit-sha>:package.json
git show <commit-sha>:package-lock.json
```

Vercel read-only inspection commands:

```bash
vercel inspect <deployment-url-or-id>
vercel logs <deployment-url-or-id>
```

Any Codex-run Vercel operation targeting Production, including inspection, logs, rollback, promotion, aliases, domains, environment variables, or settings, requires explicit **YES** approval after the exact project, environment, operation, and impact are stated.

## 9. Safe recovery from an unauthorized `main` commit

1. Preserve the commit SHA, GitHub Security Log entries, deployment URL, and timestamps.
2. Remove the affected repository from suspicious App/token access.
3. Do not force-push, reset, or delete Git history.
4. If customers are affected, use Vercel Instant Rollback to the last known-good deployment after verifying the exact target.
5. Create a revert commit on a feature branch and deliver it through the reviewed workflow.

Example preparation commands for this incident:

```bash
cd /Users/hardik/Documents/Avyukta-CRM/crm-protech
git fetch origin
git switch -c feature/revert-unauthorized-lockfile origin/main
git revert 1801b235d526d919a3b5bc6737ebb5f6bad39064
npm ci
npm run lint
npm test
npm run build
git diff --check
git status --short --branch
```

Do not push or merge until the generated revert and test results have been reviewed. Follow the repository's `feature/* -> develop -> reviewed PR -> main` policy. Never push directly to `main`.

Production commands are shown for recognition, not automatic execution:

```bash
vercel rollback <known-good-deployment-url-or-id>
vercel promote <reviewed-staged-deployment-url-or-id>
```

Both change Production and require exact-target verification and a fresh explicit **YES** before Codex may execute them.

## 10. External integration checklist

For every GitHub App, OAuth app, or fine-grained personal access token:

- Use **Only select repositories** rather than **All repositories**.
- Select only the repository the tool actively needs.
- Prefer read-only permissions unless writing is essential.
- Grant code/contents write only when the tool must commit.
- Avoid administration, workflows, secrets, and deployment write permissions unless explicitly required.
- Use a short expiration for tokens.
- Revoke unused tokens rather than keeping them for convenience.
- Recheck the repository list whenever a new repository or external project is created.
- Never give Bolt, another coding agent, or a general automation tool bypass access to `Protect main`.

## 11. Never-do list

- Never commit or push directly to `main`.
- Never allow an external development tool access to all repositories.
- Never add Bolt or another coding App to the `Protect main` bypass list.
- Never force-push `main` or erase an incident commit.
- Never use `git reset --hard` for incident recovery.
- Never use `--no-verify` or modify `.githooks` to bypass checks.
- Never promote a deployment without confirming its commit SHA.
- Never assume a successful Vercel build is authorized or safe to release.
- Never assume a GitHub Verified badge identifies the human who initiated the action.
- Never assume the project name or branch name proves which Supabase environment is targeted; verify the project reference before every database operation.

## 12. Official references

- GitHub rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
- GitHub security log: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-security-log
- GitHub App repository access: https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps
- GitHub personal access tokens: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- Vercel staged deployments and promotion: https://vercel.com/docs/deployments/promoting-a-deployment
- Vercel Git configuration: https://vercel.com/docs/project-configuration/git-configuration

