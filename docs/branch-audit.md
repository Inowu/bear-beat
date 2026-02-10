# Branch Audit

Generado: 2026-02-10T06:53:10.190Z

Repo: Inowu/bear-beat

Base detectada (origin/HEAD): `refs/remotes/origin/main`

Base branch: `main` (comparaciones contra `origin/main`)

## Paso A: Contexto y Detección

Comandos ejecutados:

```text
$ git status -sb
## codex/home-demo-playback-2026-02-10...origin/codex/home-demo-playback-2026-02-10

$ git remote -v
origin	https://github.com/Inowu/bear-beat.git (fetch)
origin	https://github.com/Inowu/bear-beat.git (push)

$ git remote show origin
* remote origin
  Fetch URL: https://github.com/Inowu/bear-beat.git
  Push  URL: https://github.com/Inowu/bear-beat.git
  HEAD branch: main
  Remote branches:
    adding-phone-number-to-manychat     tracked
    codex/home-demo-playback-2026-02-10 tracked
    folderDownload                      tracked
    main                                tracked
    prod-audit-uxui-cro-2026-02-10      tracked
    staging                             tracked
    ux-ui-cro-feb-2026                  tracked
  Local branches configured for 'git pull':
    codex/home-demo-playback-2026-02-10 merges with remote codex/home-demo-playback-2026-02-10
    main                                merges with remote main
    prod-audit-uxui-cro-2026-02-10      merges with remote prod-audit-uxui-cro-2026-02-10
    staging                             merges with remote staging
    ux-ui-cro-feb-2026                  merges with remote ux-ui-cro-feb-2026
  Local refs configured for 'git push':
    codex/home-demo-playback-2026-02-10 pushes to codex/home-demo-playback-2026-02-10 (up to date)
    main                                pushes to main                                (up to date)
    prod-audit-uxui-cro-2026-02-10      pushes to prod-audit-uxui-cro-2026-02-10      (up to date)
    staging                             pushes to staging                             (up to date)
    ux-ui-cro-feb-2026                  pushes to ux-ui-cro-feb-2026                  (up to date)

$ git symbolic-ref refs/remotes/origin/HEAD
refs/remotes/origin/main

$ git branch -a
* codex/home-demo-playback-2026-02-10
  main
  prod-audit-uxui-cro-2026-02-10
  staging
  ux-ui-cro-feb-2026
  remotes/origin/HEAD -> origin/main
  remotes/origin/adding-phone-number-to-manychat
  remotes/origin/codex/home-demo-playback-2026-02-10
  remotes/origin/folderDownload
  remotes/origin/main
  remotes/origin/prod-audit-uxui-cro-2026-02-10
  remotes/origin/staging
  remotes/origin/ux-ui-cro-feb-2026

$ git branch -vv
* codex/home-demo-playback-2026-02-10 cd72477 [origin/codex/home-demo-playback-2026-02-10] chore(lighthouse): landing mobile before/after
  main                                2bf541b [origin/main] Prod audit (read-only) + a11y/UX fixes
  prod-audit-uxui-cro-2026-02-10      ada6187 [origin/prod-audit-uxui-cro-2026-02-10] chore(audit): refresh local artifacts (post-fix rerun)
  staging                             68687ea [origin/staging] fix(home): cleaner conversion copy, mobile type, cover hero
  ux-ui-cro-feb-2026                  8068dd8 [origin/ux-ui-cro-feb-2026] chore: branch audit + cleanup plan (dry-run)

$ git worktree list
/Users/gustavogarcia/Documents/CURSOR/BEAR BEAT REAL/bear-beat  cd72477 [codex/home-demo-playback-2026-02-10]
/Users/gustavogarcia/.cursor/worktrees/bear-beat/gar            6d1e87f (detached HEAD)
/Users/gustavogarcia/.cursor/worktrees/bear-beat/lie            6d1e87f (detached HEAD)
/Users/gustavogarcia/.cursor/worktrees/bear-beat/tik            6d1e87f (detached HEAD)
```

## Paso B: Sincronización

```text
$ git fetch --all --prune
(ejecutado)
```

## Paso C/D/E: Inventario Completo (locales + origin/*)

Métodos usados:
- Merge status: `git merge-base --is-ancestor <branch> origin/main` (merge normal) o `git diff --quiet origin/main <branch>` (squash/tree-equal)
- Ahead/behind: `git rev-list --left-right --count origin/main...<branch>` (formato: behind/ahead)
- PR mapping: `gh pr list --state all --head <branch>`

### Tabla

| branch_name | local/remote | upstream | last_commit_date | last_commit_author | last_commit_subject | behind/ahead vs origin/main | merged_into_base? | merged_method | has_pr? | pr_state | pr_url | recommendation | reason |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `codex/home-demo-playback-2026-02-10` | local | `origin/codex/home-demo-playback-2026-02-10` | 2026-02-10 01:44:25 -0500 | Gustavo Garcia | chore(lighthouse): landing mobile before/after | 0/13 | no | — | sí | OPEN | https://github.com/Inowu/bear-beat/pull/59 | **DO NOT DELETE** | Rama actual (HEAD) en uso. |
| `main` | local | `origin/main` | 2026-02-09 22:56:09 -0500 | djkubo | Prod audit (read-only) + a11y/UX fixes | 0/0 | sí | ancestry | no | — | — | **DO NOT DELETE** | Rama long-lived/protegida (base o entorno). |
| `prod-audit-uxui-cro-2026-02-10` | local | `origin/prod-audit-uxui-cro-2026-02-10` | 2026-02-09 22:43:56 -0500 | Gustavo Garcia | chore(audit): refresh local artifacts (post-fix rerun) | 1/7 | sí | tree-equal | sí | MERGED | https://github.com/Inowu/bear-beat/pull/58 | **SAFE TO DELETE** | PR MERGED y tip coincide con base (tree-equal). |
| `staging` | local | `origin/staging` | 2026-02-08 18:48:29 -0500 | Gustavo Garcia | fix(home): cleaner conversion copy, mobile type, cover hero | 14/0 | sí | ancestry | no | — | — | **DO NOT DELETE** | Rama long-lived/protegida (base o entorno). |
| `ux-ui-cro-feb-2026` | local | `origin/ux-ui-cro-feb-2026` | 2026-02-09 21:27:50 -0500 | Gustavo Garcia | chore: branch audit + cleanup plan (dry-run) | 1/5 | no | — | sí | OPEN | https://github.com/Inowu/bear-beat/pull/57 | **DO NOT DELETE** | Tiene PR OPEN. |
| `origin/adding-phone-number-to-manychat` | remote | — | 2024-05-06 16:40:08 -0700 | Luis Salcido | When creating a user in manychat we add phone number as custom field | 383/1 | no | — | no | — | — | **REVIEW** | No está integrada en base y tiene commits únicos. |
| `origin/codex/home-demo-playback-2026-02-10` | remote | — | 2026-02-10 01:44:25 -0500 | Gustavo Garcia | chore(lighthouse): landing mobile before/after | 0/13 | no | — | sí | OPEN | https://github.com/Inowu/bear-beat/pull/59 | **DO NOT DELETE** | Rama actual (HEAD) en uso. |
| `origin/folderDownload` | remote | — | 2024-02-15 13:17:51 -0700 | loretoInowu | console logged state objects to test them from a button | 697/1 | no | — | no | — | — | **REVIEW** | No está integrada en base y tiene commits únicos. |
| `origin/main` | remote | — | 2026-02-09 22:56:09 -0500 | djkubo | Prod audit (read-only) + a11y/UX fixes | 0/0 | sí | ancestry | no | — | — | **DO NOT DELETE** | Rama long-lived/protegida (base o entorno). |
| `origin/prod-audit-uxui-cro-2026-02-10` | remote | — | 2026-02-09 22:43:56 -0500 | Gustavo Garcia | chore(audit): refresh local artifacts (post-fix rerun) | 1/7 | sí | tree-equal | sí | MERGED | https://github.com/Inowu/bear-beat/pull/58 | **SAFE TO DELETE** | PR MERGED y tip coincide con base (tree-equal). |
| `origin/staging` | remote | — | 2026-02-08 18:48:29 -0500 | Gustavo Garcia | fix(home): cleaner conversion copy, mobile type, cover hero | 14/0 | sí | ancestry | no | — | — | **DO NOT DELETE** | Rama long-lived/protegida (base o entorno). |
| `origin/ux-ui-cro-feb-2026` | remote | — | 2026-02-09 21:27:50 -0500 | Gustavo Garcia | chore: branch audit + cleanup plan (dry-run) | 1/5 | no | — | sí | OPEN | https://github.com/Inowu/bear-beat/pull/57 | **DO NOT DELETE** | Tiene PR OPEN. |

## Recomendación Final

### SAFE TO DELETE NOW

Local:
- `prod-audit-uxui-cro-2026-02-10`

Remoto (origin):
- `prod-audit-uxui-cro-2026-02-10`

### KEEP

- (ninguna)

### REVIEW

- `origin/adding-phone-number-to-manychat`: No está integrada en base y tiene commits únicos.
- `origin/folderDownload`: No está integrada en base y tiene commits únicos.

### DO NOT DELETE

- `codex/home-demo-playback-2026-02-10`: Rama actual (HEAD) en uso.
- `main`: Rama long-lived/protegida (base o entorno).
- `staging`: Rama long-lived/protegida (base o entorno).
- `ux-ui-cro-feb-2026`: Tiene PR OPEN.
- `origin/codex/home-demo-playback-2026-02-10`: Rama actual (HEAD) en uso.
- `origin/main`: Rama long-lived/protegida (base o entorno).
- `origin/staging`: Rama long-lived/protegida (base o entorno).
- `origin/ux-ui-cro-feb-2026`: Tiene PR OPEN.

## Evidencia Detallada

### SAFE TO DELETE: prod-audit-uxui-cro-2026-02-10

```text
$ git merge-base --is-ancestor prod-audit-uxui-cro-2026-02-10 origin/main
exit=1

$ git diff --quiet origin/main prod-audit-uxui-cro-2026-02-10
exit=0

$ gh pr list --state all --head prod-audit-uxui-cro-2026-02-10
58	Prod audit (read-only) + a11y/UX fixes	prod-audit-uxui-cro-2026-02-10	MERGED	2026-02-10T03:39:31Z
```

### REVIEW: origin/adding-phone-number-to-manychat

```text
$ git log -1 --format="%ci | %an | %s" origin/adding-phone-number-to-manychat
2024-05-06 16:40:08 -0700 | Luis Salcido | When creating a user in manychat we add phone number as custom field

$ git rev-list --left-right --count origin/main...origin/adding-phone-number-to-manychat
383	1

$ git merge-base --is-ancestor origin/adding-phone-number-to-manychat origin/main
exit=1

$ git diff --stat origin/main origin/adding-phone-number-to-manychat
 .DS_Store                                          |   Bin 0 -> 6148 bytes
 .github/workflows/backend-deploy.yml               |    33 -
 .gitignore                                         |    13 -
 README.md                                          |   143 +-
 audit/UI_UX_CRO_AUDIT.md                           |   109 -
 backend/.env.example                               |    68 -
 backend/.gitignore                                 |     4 -
 backend/AGENTS.md                                  |    28 -
 backend/docker-compose.yaml                        |     1 +
 backend/ecosystem.config.js                        |     7 -
 backend/jest.config.js                             |    15 +-
 backend/package.json                               |    30 +-

$ gh pr list --state all --head adding-phone-number-to-manychat

```

### REVIEW: origin/folderDownload

```text
$ git log -1 --format="%ci | %an | %s" origin/folderDownload
2024-02-15 13:17:51 -0700 | loretoInowu | console logged state objects to test them from a button

$ git rev-list --left-right --count origin/main...origin/folderDownload
697	1

$ git merge-base --is-ancestor origin/folderDownload origin/main
exit=1

$ git diff --stat origin/main origin/folderDownload
 .DS_Store                                          |   Bin 0 -> 6148 bytes
 .github/pull_request_template.md                   |    18 -
 .github/workflows/backend-deploy.yml               |    33 -
 .gitignore                                         |    13 -
 README.md                                          |   143 +-
 audit/UI_UX_CRO_AUDIT.md                           |   109 -
 backend/.dockerignore                              |     7 -
 backend/.env.example                               |    68 -
 backend/.eslintrc.json                             |     3 +-
 backend/.gitignore                                 |     5 -
 backend/AGENTS.md                                  |    28 -
 backend/Dockerfile                                 |     1 +

$ gh pr list --state all --head folderDownload

```
