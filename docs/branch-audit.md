# Branch Audit

Generado: 2026-02-10T05:26:31+00:00

Repo: Inowu/bear-beat

Base detectada (origin/HEAD): `refs/remotes/origin/main`

Base branch: `main` (comparaciones contra `origin/main`)

## Paso A: Contexto y Detección

Comandos ejecutados:

```text
$ git status
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
* codex/home-demo-playback-2026-02-10 20d4c8f [origin/codex/home-demo-playback-2026-02-10] fix(plans): reduce saturation, improve hierarchy
  main                                2bf541b [origin/main] Prod audit (read-only) + a11y/UX fixes
  prod-audit-uxui-cro-2026-02-10      ada6187 [origin/prod-audit-uxui-cro-2026-02-10] chore(audit): refresh local artifacts (post-fix rerun)
  staging                             68687ea [origin/staging] fix(home): cleaner conversion copy, mobile type, cover hero
  ux-ui-cro-feb-2026                  8068dd8 [origin/ux-ui-cro-feb-2026] chore: branch audit + cleanup plan (dry-run)

$ git worktree list
/Users/gustavogarcia/Documents/CURSOR/BEAR BEAT REAL/bear-beat  20d4c8f [codex/home-demo-playback-2026-02-10]
/Users/gustavogarcia/.cursor/worktrees/bear-beat/gar            6d1e87f (detached HEAD)
/Users/gustavogarcia/.cursor/worktrees/bear-beat/lie            6d1e87f (detached HEAD)
/Users/gustavogarcia/.cursor/worktrees/bear-beat/tik            6d1e87f (detached HEAD)
```

## Paso B: Sincronización

```text
$ git fetch --all --prune
(ejecutado; sin output)
```

## Paso C/D/E: Inventario Completo (locales + origin/*)

Métodos usados:
- Merge status: `git merge-base --is-ancestor <branch> origin/main` + verificación adicional `tree-equal` cuando hay squash merge
- Ahead/behind: `git rev-list --left-right --count origin/main...<branch>` (formato: behind/ahead)
- PR mapping: `gh pr list --state all --head <branch>`

### Tabla

| branch_name | local/remote | upstream | last_commit_date | last_commit_author | last_commit_subject | behind/ahead vs origin/main | merged_into_base? | merged_method | has_pr? | pr_state | pr_url | recommendation | reason |
|---|---:|---|---|---|---|---:|---:|---|---:|---|---|---|---|
| `codex/home-demo-playback-2026-02-10` | local | `origin/codex/home-demo-playback-2026-02-10` | 2026-02-10 00:12:21 -0500 | Gustavo Garcia | fix(plans): reduce saturation, improve hierarchy | 0/5 | no | — | sí | OPEN | https://github.com/Inowu/bear-beat/pull/59 | **DO NOT DELETE** | Rama actual (HEAD) en uso. |
| `main` | local | `origin/main` | 2026-02-09 22:56:09 -0500 | djkubo | Prod audit (read-only) + a11y/UX fixes | 0/0 | sí | ancestry | no | none | — | **DO NOT DELETE** | Rama long-lived/protegida (base o entorno). |
| `staging` | local | `origin/staging` | 2026-02-08 18:48:29 -0500 | Gustavo Garcia | fix(home): cleaner conversion copy, mobile type, cover hero | 14/0 | sí | ancestry | no | none | — | **DO NOT DELETE** | Rama long-lived/protegida (base o entorno). |
| `ux-ui-cro-feb-2026` | local | `origin/ux-ui-cro-feb-2026` | 2026-02-09 21:27:50 -0500 | Gustavo Garcia | chore: branch audit + cleanup plan (dry-run) | 1/5 | no | — | sí | OPEN | https://github.com/Inowu/bear-beat/pull/57 | **DO NOT DELETE** | Tiene PR OPEN. |
| `origin/codex/home-demo-playback-2026-02-10` | remote | — | 2026-02-10 00:12:21 -0500 | Gustavo Garcia | fix(plans): reduce saturation, improve hierarchy | 0/5 | no | — | sí | OPEN | https://github.com/Inowu/bear-beat/pull/59 | **DO NOT DELETE** | Tiene PR OPEN. |
| `origin/main` | remote | — | 2026-02-09 22:56:09 -0500 | djkubo | Prod audit (read-only) + a11y/UX fixes | 0/0 | sí | ancestry | no | none | — | **DO NOT DELETE** | Rama long-lived/protegida (base o entorno). |
| `origin/staging` | remote | — | 2026-02-08 18:48:29 -0500 | Gustavo Garcia | fix(home): cleaner conversion copy, mobile type, cover hero | 14/0 | sí | ancestry | no | none | — | **DO NOT DELETE** | Rama long-lived/protegida (base o entorno). |
| `origin/ux-ui-cro-feb-2026` | remote | — | 2026-02-09 21:27:50 -0500 | Gustavo Garcia | chore: branch audit + cleanup plan (dry-run) | 1/5 | no | — | sí | OPEN | https://github.com/Inowu/bear-beat/pull/57 | **DO NOT DELETE** | Tiene PR OPEN. |
| `origin/adding-phone-number-to-manychat` | remote | — | 2024-05-06 16:40:08 -0700 | Luis Salcido | When creating a user in manychat we add phone number as custom field | 383/1 | no | — | no | none | — | **REVIEW** | No está integrado en base y tiene commits únicos. |
| `origin/folderDownload` | remote | — | 2024-02-15 13:17:51 -0700 | loretoInowu | console logged state objects to test them from a button | 697/1 | no | — | no | none | — | **REVIEW** | No está integrado en base y tiene commits únicos. |
| `prod-audit-uxui-cro-2026-02-10` | local | `origin/prod-audit-uxui-cro-2026-02-10` | 2026-02-09 22:43:56 -0500 | Gustavo Garcia | chore(audit): refresh local artifacts (post-fix rerun) | 1/7 | sí | tree-equal | sí | MERGED | https://github.com/Inowu/bear-beat/pull/58 | **SAFE TO DELETE** | Contenido ya integrado en base (ancestry o tree-equal). |
| `origin/prod-audit-uxui-cro-2026-02-10` | remote | — | 2026-02-09 22:43:56 -0500 | Gustavo Garcia | chore(audit): refresh local artifacts (post-fix rerun) | 1/7 | sí | tree-equal | sí | MERGED | https://github.com/Inowu/bear-beat/pull/58 | **SAFE TO DELETE** | Contenido ya integrado en base (ancestry o tree-equal). |

## Recomendación Final

### SAFE TO DELETE NOW

Local:
- `prod-audit-uxui-cro-2026-02-10`

Remoto (origin):
- `prod-audit-uxui-cro-2026-02-10`

### KEEP

- (ninguna)

### REVIEW

- `origin/adding-phone-number-to-manychat`: No está integrado en base y tiene commits únicos.
- `origin/folderDownload`: No está integrado en base y tiene commits únicos.

### DO NOT DELETE

- `codex/home-demo-playback-2026-02-10`: Rama actual (HEAD) en uso.
- `main`: Rama long-lived/protegida (base o entorno).
- `staging`: Rama long-lived/protegida (base o entorno).
- `ux-ui-cro-feb-2026`: Tiene PR OPEN.
- `origin/codex/home-demo-playback-2026-02-10`: Tiene PR OPEN.
- `origin/main`: Rama long-lived/protegida (base o entorno).
- `origin/staging`: Rama long-lived/protegida (base o entorno).
- `origin/ux-ui-cro-feb-2026`: Tiene PR OPEN.

## Evidencia Detallada (REVIEW)

### origin/adding-phone-number-to-manychat

```text
$ git log -1 --format="%ci | %an | %s" origin/adding-phone-number-to-manychat
2024-05-06 16:40:08 -0700 | Luis Salcido | When creating a user in manychat we add phone number as custom field

$ git rev-list --left-right --count origin/main...origin/adding-phone-number-to-manychat
383	1

$ git merge-base --is-ancestor origin/adding-phone-number-to-manychat origin/main
exit=1

$ git cherry -v origin/main origin/adding-phone-number-to-manychat
+ 289b65f26d7faf9f5031f8c70442d012e398ec89 When creating a user in manychat we add phone number as custom field

$ gh pr list --state all --head adding-phone-number-to-manychat

```

### origin/folderDownload

```text
$ git log -1 --format="%ci | %an | %s" origin/folderDownload
2024-02-15 13:17:51 -0700 | loretoInowu | console logged state objects to test them from a button

$ git rev-list --left-right --count origin/main...origin/folderDownload
697	1

$ git merge-base --is-ancestor origin/folderDownload origin/main
exit=1

$ git cherry -v origin/main origin/folderDownload
+ a27012cc9a50b1f9dc773e0442a3eb29fc1fd1ed console logged state objects to test them from a button

$ gh pr list --state all --head folderDownload

```
