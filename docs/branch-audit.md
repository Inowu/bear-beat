# Branch Audit

Generado: 2026-02-10T02:26:48Z

Repo: `Inowu/bear-beat`

Base detectada (origin/HEAD): `refs/remotes/origin/main`

Base branch: `main` (comparaciones contra `origin/main`)

## Paso A: Contexto y Detección (antes de fetch)

```text
$ git status
On branch ux-ui-cro-feb-2026
Your branch is up to date with 'origin/ux-ui-cro-feb-2026'.

nothing to commit, working tree clean
```

```text
$ git remote -v
origin	https://github.com/Inowu/bear-beat.git (fetch)
origin	https://github.com/Inowu/bear-beat.git (push)
```

```text
$ git remote show origin
* remote origin
  Fetch URL: https://github.com/Inowu/bear-beat.git
  Push  URL: https://github.com/Inowu/bear-beat.git
  HEAD branch: main
  Remote branches:
    adding-phone-number-to-manychat tracked
    folderDownload                  tracked
    main                            tracked
    staging                         tracked
    ux-ui-cro-feb-2026              tracked
  Local branches configured for 'git pull':
    main               merges with remote main
    staging            merges with remote staging
    ux-ui-cro-feb-2026 merges with remote ux-ui-cro-feb-2026
  Local refs configured for 'git push':
    main               pushes to main               (up to date)
    staging            pushes to staging            (up to date)
    ux-ui-cro-feb-2026 pushes to ux-ui-cro-feb-2026 (up to date)
```

```text
$ git symbolic-ref refs/remotes/origin/HEAD
refs/remotes/origin/main
```

```text
$ git branch -a
  main
  staging
* ux-ui-cro-feb-2026
  remotes/origin/HEAD -> origin/main
  remotes/origin/adding-phone-number-to-manychat
  remotes/origin/folderDownload
  remotes/origin/main
  remotes/origin/staging
  remotes/origin/ux-ui-cro-feb-2026
```

```text
$ git branch -vv
  main               8ecf98d [origin/main] audit: enforce auth coverage and refresh artifacts
  staging            68687ea [origin/staging] fix(home): cleaner conversion copy, mobile type, cover hero
* ux-ui-cro-feb-2026 c7d4d20 [origin/ux-ui-cro-feb-2026] docs: ux/ui/cro report (feb 2026)
```

```text
$ git worktree list
/Users/gustavogarcia/Documents/CURSOR/BEAR BEAT REAL/bear-beat  c7d4d20 [ux-ui-cro-feb-2026]
/Users/gustavogarcia/.cursor/worktrees/bear-beat/gar            6d1e87f (detached HEAD)
/Users/gustavogarcia/.cursor/worktrees/bear-beat/lie            6d1e87f (detached HEAD)
/Users/gustavogarcia/.cursor/worktrees/bear-beat/tik            6d1e87f (detached HEAD)
```

## Paso B: Sincronización (sin cambios destructivos)

```text
$ git fetch --all --prune
(sin output)
```

```text
$ git branch -a (post-fetch)
  main
  staging
* ux-ui-cro-feb-2026
  remotes/origin/HEAD -> origin/main
  remotes/origin/adding-phone-number-to-manychat
  remotes/origin/folderDownload
  remotes/origin/main
  remotes/origin/staging
  remotes/origin/ux-ui-cro-feb-2026
```

```text
$ git branch -vv (post-fetch)
  main               8ecf98d [origin/main] audit: enforce auth coverage and refresh artifacts
  staging            68687ea [origin/staging] fix(home): cleaner conversion copy, mobile type, cover hero
* ux-ui-cro-feb-2026 c7d4d20 [origin/ux-ui-cro-feb-2026] docs: ux/ui/cro report (feb 2026)
```

## Paso C/D/E: Inventario Completo (locales + origin/*)

Métodos usados (evidencia):

- Último commit: `git log -1 --format="%ci | %an | %s" <branch>`
- Ahead/behind vs base: `git rev-list --left-right --count origin/main...<branch>` (formato: `behind/ahead`)
- Merge status: `git merge-base --is-ancestor <branch> origin/main`
- PR mapping (GitHub): `gh pr list --state all --head <branch> --json number,title,state,isDraft,mergedAt,url,baseRefName`

### Tabla

| branch_name | local/remote | upstream | last_commit_date | last_commit_author | last_commit_subject | behind/ahead vs origin/main | merged_into_base? | has_pr? | pr_state | pr_url | recommendation | reason |
|---|---|---|---|---|---|---:|---:|---:|---|---|---|---|
| `main` | local | `origin/main` | 2026-02-09 19:02:45 -0500 | Gustavo Garcia | audit: enforce auth coverage and refresh artifacts | 0/0 | sí | no | — | — | **DO NOT DELETE** | Rama long-lived/protegida. |
| `staging` | local | `origin/staging` | 2026-02-08 18:48:29 -0500 | Gustavo Garcia | fix(home): cleaner conversion copy, mobile type, cover hero | 13/0 | sí | no | — | — | **DO NOT DELETE** | Rama long-lived/protegida. |
| `ux-ui-cro-feb-2026` | local | `origin/ux-ui-cro-feb-2026` | 2026-02-09 21:20:45 -0500 | Gustavo Garcia | docs: ux/ui/cro report (feb 2026) | 0/4 | no | sí | open | [link](https://github.com/Inowu/bear-beat/pull/57) | **DO NOT DELETE** | Rama en uso por un worktree. |
| `origin/adding-phone-number-to-manychat` | remote | `—` | 2024-05-06 16:40:08 -0700 | Luis Salcido | When creating a user in manychat we add phone number as custom field | 382/1 | no | no | — | — | **REVIEW** | No merged en base; contiene commits únicos o requiere decisión. |
| `origin/folderDownload` | remote | `—` | 2024-02-15 13:17:51 -0700 | loretoInowu | console logged state objects to test them from a button | 696/1 | no | no | — | — | **REVIEW** | No merged en base; contiene commits únicos o requiere decisión. |
| `origin/main` | remote | `—` | 2026-02-09 19:02:45 -0500 | Gustavo Garcia | audit: enforce auth coverage and refresh artifacts | 0/0 | sí | no | — | — | **DO NOT DELETE** | Rama long-lived/protegida. |
| `origin/staging` | remote | `—` | 2026-02-08 18:48:29 -0500 | Gustavo Garcia | fix(home): cleaner conversion copy, mobile type, cover hero | 13/0 | sí | no | — | — | **DO NOT DELETE** | Rama long-lived/protegida. |
| `origin/ux-ui-cro-feb-2026` | remote | `—` | 2026-02-09 21:20:45 -0500 | Gustavo Garcia | docs: ux/ui/cro report (feb 2026) | 0/4 | no | sí | open | [link](https://github.com/Inowu/bear-beat/pull/57) | **DO NOT DELETE** | Rama en uso por un worktree. |

## Paso F: Recomendación Final

### SAFE TO DELETE NOW

- (ninguna)

### KEEP

- (ninguna)

### REVIEW

- `origin/adding-phone-number-to-manychat` (tiene 1 commit no merged)
- `origin/folderDownload` (tiene 1 commit no merged)

### DO NOT DELETE

- `main`, `origin/main`
- `staging`, `origin/staging`
- `ux-ui-cro-feb-2026`, `origin/ux-ui-cro-feb-2026` (PR abierto)

## Paso G: Comandos de Limpieza (PERO NO EJECUTAR)

Se generó/actualizó script dry-run:

- `scripts/branch-cleanup.sh`

