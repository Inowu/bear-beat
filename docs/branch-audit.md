# Branch Audit

Generado: 2026-02-09T23:11:28.329Z

Repo: Inowu/bear-beat

Base detectada (origin/HEAD): `refs/remotes/origin/main`

Base branch: `main` (comparaciones contra `origin/main`)

## Paso A: Contexto y Detección (antes de fetch)


```text
$ git status
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   docs/audit/a11y-report.md
	modified:   docs/audit/cro-findings.md
	modified:   docs/audit/error-copy-catalog.json
	modified:   docs/audit/ui-inventory.json

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/branch-audit.md

no changes added to commit (use "git add" and/or "git commit -a")
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
    CURSOR-GUSTAVO                                   tracked
    adding-phone-number-to-manychat                  tracked
    allow-non-admin-to-find-video-config             tracked
    backend                                          tracked
    codex/home-cro-2026                              tracked
    filter-orders-by-email-and-phone                 tracked
    fix-anual-subscribers-renowal                    tracked
    fixing-bad-subscriptions                         tracked
    fixing-orders-not-being-marked-as-failed         tracked
    folderDownload                                   tracked
    jorge                                            tracked
    list-of-allowed-countries                        tracked
    main                                             tracked
    redirecting-users-with-plan-to-upgrade-plan-page tracked
    select-user-type-when-creating-new-user          tracked
    staging                                          tracked
    test                                             tracked
    uh-migration                                     tracked
  Local branches configured for 'git pull':
    CURSOR-GUSTAVO      merges with remote CURSOR-GUSTAVO
    codex/home-cro-2026 merges with remote codex/home-cro-2026
    main                merges with remote main
    staging             merges with remote staging
  Local refs configured for 'git push':
    CURSOR-GUSTAVO      pushes to CURSOR-GUSTAVO      (up to date)
    codex/home-cro-2026 pushes to codex/home-cro-2026 (up to date)
    main                pushes to main                (up to date)
    staging             pushes to staging             (up to date)
```


```text
$ git symbolic-ref refs/remotes/origin/HEAD
refs/remotes/origin/main
```


```text
$ git branch -a
  CURSOR-GUSTAVO
  codex/crm-trial-checkout
  codex/fix-conekta-payments
  codex/fullsite-ux-audit
  codex/fullsite-ux-audit-2026
  codex/home-cro-2026
  codex/home-cro-pass2
  codex/home-cro-pass3
  codex/nivel-dios-crm-automation
  codex/ux-ui-cro-audit-20260209
* main
  staging
  remotes/origin/CURSOR-GUSTAVO
  remotes/origin/HEAD -> origin/main
  remotes/origin/adding-phone-number-to-manychat
  remotes/origin/allow-non-admin-to-find-video-config
  remotes/origin/backend
  remotes/origin/codex/home-cro-2026
  remotes/origin/filter-orders-by-email-and-phone
  remotes/origin/fix-anual-subscribers-renowal
  remotes/origin/fixing-bad-subscriptions
  remotes/origin/fixing-orders-not-being-marked-as-failed
  remotes/origin/folderDownload
  remotes/origin/jorge
  remotes/origin/list-of-allowed-countries
  remotes/origin/main
  remotes/origin/redirecting-users-with-plan-to-upgrade-plan-page
  remotes/origin/select-user-type-when-creating-new-user
  remotes/origin/staging
  remotes/origin/test
  remotes/origin/uh-migration
```


```text
$ git branch -vv
  CURSOR-GUSTAVO                  2431193 [origin/CURSOR-GUSTAVO] conekta: add BBVA pay_by_bank checkout + OXXO + fingerprint
  codex/crm-trial-checkout        02c8f9a feat: CRM dashboard + trial + UX tracking + payment hardening
  codex/fix-conekta-payments      b6a9201 Fix Conekta BBVA HostedPayment payload
  codex/fullsite-ux-audit         8589c80 feat(frontend): CRO tracking + formatting + UX quick wins
  codex/fullsite-ux-audit-2026    534e17c fix(auth): registro sin fricción + audit outputs
  codex/home-cro-2026             c5e8c4e [origin/codex/home-cro-2026] feat(home): CRO redesign (PublicHome)
  codex/home-cro-pass2            d92bee9 feat(home): CRO pass2 CTA + demo + top downloads
  codex/home-cro-pass3            eb80456 feat(home): CRO pass3 formatting + proof + sticky CTA
  codex/nivel-dios-crm-automation ff6282b feat(crm): automation runner, offers, and admin metrics
  codex/ux-ui-cro-audit-20260209  2431193 conekta: add BBVA pay_by_bank checkout + OXXO + fingerprint
* main                            1283acc [origin/main] docs: sync audit stats
  staging                         68687ea [origin/staging] fix(home): cleaner conversion copy, mobile type, cover hero
```


```text
$ git worktree list
/Users/gustavogarcia/Documents/CURSOR/BEAR BEAT REAL/bear-beat  1283acc [main]
/Users/gustavogarcia/.cursor/worktrees/bear-beat/gar            6d1e87f (detached HEAD)
/Users/gustavogarcia/.cursor/worktrees/bear-beat/lie            6d1e87f (detached HEAD)
/Users/gustavogarcia/.cursor/worktrees/bear-beat/tik            6d1e87f (detached HEAD)
```

## Paso B: Sincronización


```text
$ git fetch --all --prune
(sin output)
```


```text
$ git branch -a (post-fetch)
  CURSOR-GUSTAVO
  codex/crm-trial-checkout
  codex/fix-conekta-payments
  codex/fullsite-ux-audit
  codex/fullsite-ux-audit-2026
  codex/home-cro-2026
  codex/home-cro-pass2
  codex/home-cro-pass3
  codex/nivel-dios-crm-automation
  codex/ux-ui-cro-audit-20260209
* main
  staging
  remotes/origin/CURSOR-GUSTAVO
  remotes/origin/HEAD -> origin/main
  remotes/origin/adding-phone-number-to-manychat
  remotes/origin/allow-non-admin-to-find-video-config
  remotes/origin/backend
  remotes/origin/codex/home-cro-2026
  remotes/origin/filter-orders-by-email-and-phone
  remotes/origin/fix-anual-subscribers-renowal
  remotes/origin/fixing-bad-subscriptions
  remotes/origin/fixing-orders-not-being-marked-as-failed
  remotes/origin/folderDownload
  remotes/origin/jorge
  remotes/origin/list-of-allowed-countries
  remotes/origin/main
  remotes/origin/redirecting-users-with-plan-to-upgrade-plan-page
  remotes/origin/select-user-type-when-creating-new-user
  remotes/origin/staging
  remotes/origin/test
  remotes/origin/uh-migration
```


```text
$ git branch -vv (post-fetch)
  CURSOR-GUSTAVO                  2431193 [origin/CURSOR-GUSTAVO] conekta: add BBVA pay_by_bank checkout + OXXO + fingerprint
  codex/crm-trial-checkout        02c8f9a feat: CRM dashboard + trial + UX tracking + payment hardening
  codex/fix-conekta-payments      b6a9201 Fix Conekta BBVA HostedPayment payload
  codex/fullsite-ux-audit         8589c80 feat(frontend): CRO tracking + formatting + UX quick wins
  codex/fullsite-ux-audit-2026    534e17c fix(auth): registro sin fricción + audit outputs
  codex/home-cro-2026             c5e8c4e [origin/codex/home-cro-2026] feat(home): CRO redesign (PublicHome)
  codex/home-cro-pass2            d92bee9 feat(home): CRO pass2 CTA + demo + top downloads
  codex/home-cro-pass3            eb80456 feat(home): CRO pass3 formatting + proof + sticky CTA
  codex/nivel-dios-crm-automation ff6282b feat(crm): automation runner, offers, and admin metrics
  codex/ux-ui-cro-audit-20260209  2431193 conekta: add BBVA pay_by_bank checkout + OXXO + fingerprint
* main                            1283acc [origin/main] docs: sync audit stats
  staging                         68687ea [origin/staging] fix(home): cleaner conversion copy, mobile type, cover hero
```

## Paso C/D/E: Inventario Completo (locales + origin/*)

Métodos usados:
- Merge status: `git merge-base --is-ancestor <branch> origin/main` (confirmación) + listas `git branch --merged/--no-merged origin/main`
- Ahead/behind: `git rev-list --left-right --count origin/main...<branch>` (formato: behind/ahead)
- PR mapping: `gh pr list --state all --head <branch>` (fallback `Inowu:<branch>`)

> Nota: Se detectaron worktrees adicionales (detached HEAD). Solo se marca “en uso” si el worktree declara `branch refs/heads/<x>`.

### Tabla

| branch_name | local/remote | upstream | last_commit_date | last_commit_author | last_commit_subject | behind/ahead vs origin/main | merged_into_base? | merged_list_hint | has_pr? | pr_state | pr_url | recommendation | reason |
|---|---:|---|---|---|---|---:|---:|---|---:|---|---|---|---|
| `codex/crm-trial-checkout` | local | — | 2026-02-08 09:12:53 -0500 | Gustavo Garcia | feat: CRM dashboard + trial + UX tracking + payment hardening | 24/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `codex/fix-conekta-payments` | local | — | 2026-02-08 01:39:01 -0500 | Gustavo Garcia | Fix Conekta BBVA HostedPayment payload | 26/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `codex/fullsite-ux-audit` | local | — | 2026-02-09 00:49:49 -0500 | Gustavo Garcia | feat(frontend): CRO tracking + formatting + UX quick wins | 6/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `codex/fullsite-ux-audit-2026` | local | — | 2026-02-09 12:37:49 -0500 | Gustavo Garcia | fix(auth): registro sin fricción + audit outputs | 4/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `codex/home-cro-2026` | local | origin/codex/home-cro-2026 | 2026-02-08 19:42:46 -0500 | Gustavo Garcia | feat(home): CRO redesign (PublicHome) | 11/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `codex/home-cro-pass2` | local | — | 2026-02-08 20:53:03 -0500 | Gustavo Garcia | feat(home): CRO pass2 CTA + demo + top downloads | 10/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `codex/home-cro-pass3` | local | — | 2026-02-08 22:15:53 -0500 | Gustavo Garcia | feat(home): CRO pass3 formatting + proof + sticky CTA | 9/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `codex/nivel-dios-crm-automation` | local | — | 2026-02-08 14:46:12 -0500 | Gustavo Garcia | feat(crm): automation runner, offers, and admin metrics | 19/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `codex/ux-ui-cro-audit-20260209` | local | — | 2026-02-08 00:18:56 -0500 | Gustavo Garcia | conekta: add BBVA pay_by_bank checkout + OXXO + fingerprint | 36/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `CURSOR-GUSTAVO` | local | origin/CURSOR-GUSTAVO | 2026-02-08 00:18:56 -0500 | Gustavo Garcia | conekta: add BBVA pay_by_bank checkout + OXXO + fingerprint | 36/0 | sí | merged-list | sí | merged | [link](https://github.com/Inowu/bear-beat/pull/54) | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `main` | local | origin/main | 2026-02-09 17:41:24 -0500 | Gustavo Garcia | docs: sync audit stats | 0/0 | sí | merged-list | no | none | — | **DO NOT DELETE** | Rama long-lived/protegida (base o entorno). |
| `origin/adding-phone-number-to-manychat` | remote | — | 2024-05-06 16:40:08 -0700 | Luis Salcido | When creating a user in manychat we add phone number as custom field | 381/1 | no | no-merged-list | no | none | — | **REVIEW** | No merged en origin/main; contiene commits únicos (ahead=1). |
| `origin/allow-non-admin-to-find-video-config` | remote | — | 2024-06-14 17:16:58 -0700 | Luis Salcido | Non admin user should be able to find the config video setting | 291/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `origin/backend` | remote | — | 2024-12-30 15:40:46 -0800 | FerIbarraInowu | Update Home.tsx | 220/0 | sí | merged-list | sí | closed | [link](https://github.com/Inowu/bear-beat/pull/6) | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `origin/codex/home-cro-2026` | remote | — | 2026-02-08 19:42:46 -0500 | Gustavo Garcia | feat(home): CRO redesign (PublicHome) | 11/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `origin/CURSOR-GUSTAVO` | remote | — | 2026-02-08 00:18:56 -0500 | Gustavo Garcia | conekta: add BBVA pay_by_bank checkout + OXXO + fingerprint | 36/0 | sí | merged-list | sí | merged | [link](https://github.com/Inowu/bear-beat/pull/54) | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `origin/filter-orders-by-email-and-phone` | remote | — | 2024-04-04 13:16:03 -0700 | Luis Salcido | Merge branch 'main' into filter-orders-by-email-and-phone | 575/2 | no | no-merged-list | no | none | — | **REVIEW** | No merged en origin/main; contiene commits únicos (ahead=2). |
| `origin/fix-anual-subscribers-renowal` | remote | — | 2024-08-20 17:20:58 -0700 | Luis Salcido | fixing users anual renowal | 289/0 | sí | merged-list | sí | merged | [link](https://github.com/Inowu/bear-beat/pull/50) | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `origin/fixing-bad-subscriptions` | remote | — | 2024-08-30 12:29:56 -0700 | Luis Salcido | Subscription changed message improved | 251/0 | sí | merged-list | sí | merged | [link](https://github.com/Inowu/bear-beat/pull/52) | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `origin/fixing-orders-not-being-marked-as-failed` | remote | — | 2024-08-30 09:32:18 -0700 | Luis Salcido | Merge branch 'backend' into fixing-orders-not-being-marked-as-failed | 256/0 | sí | merged-list | sí | merged | [link](https://github.com/Inowu/bear-beat/pull/51) | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `origin/folderDownload` | remote | — | 2024-02-15 13:17:51 -0700 | loretoInowu | console logged state objects to test them from a button | 695/1 | no | no-merged-list | no | none | — | **REVIEW** | No merged en origin/main; contiene commits únicos (ahead=1). |
| `origin/jorge` | remote | — | 2024-03-01 13:17:31 -0700 | andreiwoolfolk95 | oxxomodal | 633/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `origin/list-of-allowed-countries` | remote | — | 2026-01-08 14:57:47 -0700 | Luis Salcido | using github actions for automatic ci/cd | 208/0 | sí | merged-list | sí | merged | [link](https://github.com/Inowu/bear-beat/pull/53) | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `origin/main` | remote | — | 2026-02-09 17:41:24 -0500 | Gustavo Garcia | docs: sync audit stats | 0/0 | sí | merged-list | no | none | — | **DO NOT DELETE** | Rama long-lived/protegida (base o entorno). |
| `origin/redirecting-users-with-plan-to-upgrade-plan-page` | remote | — | 2024-05-09 13:04:37 -0700 | Luis Salcido | Redirecting users with plan so they can't buy an additional plan | 349/0 | sí | merged-list | sí | merged | [link](https://github.com/Inowu/bear-beat/pull/41) | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `origin/select-user-type-when-creating-new-user` | remote | — | 2024-05-13 16:41:41 -0700 | Luis Salcido | Merge branch 'main' into select-user-type-when-creating-new-user | 339/0 | sí | merged-list | sí | merged | [link](https://github.com/Inowu/bear-beat/pull/43) | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `origin/staging` | remote | — | 2026-02-08 18:48:29 -0500 | Gustavo Garcia | fix(home): cleaner conversion copy, mobile type, cover hero | 12/0 | sí | merged-list | no | none | — | **DO NOT DELETE** | Rama long-lived/protegida (base o entorno). |
| `origin/test` | remote | — | 2024-01-25 10:02:21 -0700 | andreiwoolfolk95 | refresh token implement | 730/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `origin/uh-migration` | remote | — | 2024-12-16 17:18:01 -0700 | Christian Rivera | remove secret in docker compose file | 243/0 | sí | merged-list | no | none | — | **SAFE TO DELETE** | Merged en origin/main por ancestry (merge-base). |
| `staging` | local | origin/staging | 2026-02-08 18:48:29 -0500 | Gustavo Garcia | fix(home): cleaner conversion copy, mobile type, cover hero | 12/0 | sí | merged-list | no | none | — | **DO NOT DELETE** | Rama long-lived/protegida (base o entorno). |

## Paso F: Recomendación Final

### SAFE TO DELETE NOW

Local:
- `codex/crm-trial-checkout`
- `codex/fix-conekta-payments`
- `codex/fullsite-ux-audit`
- `codex/fullsite-ux-audit-2026`
- `codex/home-cro-2026`
- `codex/home-cro-pass2`
- `codex/home-cro-pass3`
- `codex/nivel-dios-crm-automation`
- `codex/ux-ui-cro-audit-20260209`
- `CURSOR-GUSTAVO`

Remote (origin):
- `allow-non-admin-to-find-video-config`
- `backend`
- `codex/home-cro-2026`
- `CURSOR-GUSTAVO`
- `fix-anual-subscribers-renowal`
- `fixing-bad-subscriptions`
- `fixing-orders-not-being-marked-as-failed`
- `jorge`
- `list-of-allowed-countries`
- `redirecting-users-with-plan-to-upgrade-plan-page`
- `select-user-type-when-creating-new-user`
- `test`
- `uh-migration`

### KEEP

- (ninguna)

### REVIEW

- `origin/adding-phone-number-to-manychat`
- `origin/filter-orders-by-email-and-phone`
- `origin/folderDownload`

### DO NOT DELETE

- `main`
- `origin/main`
- `origin/staging`
- `staging`

## Paso G: Plan de Limpieza (sin ejecutar)

1. Confirmar que no hay worktrees usando ramas candidatas (ver Paso A).
2. Borrar primero ramas locales SAFE TO DELETE con `git branch -d`.
3. Borrar después ramas remotas SAFE TO DELETE con `git push origin --delete`.
4. Para REVIEW: decidir si se quiere abrir PR, cherry-pick, o descartar cambios; no borrar hasta resolver.

## Cleanup Ejecutado (Post-Approval)

Fecha (UTC): 2026-02-09T23:27:28Z

El usuario confirmó ejecutar la limpieza. Se borraron únicamente ramas marcadas como **SAFE TO DELETE** (no se tocaron ramas long-lived como `main`, `staging`, `release/*`, `hotfix/*`).

### Comandos Ejecutados (local)

```text
git branch -d codex/crm-trial-checkout
git branch -d codex/fix-conekta-payments
git branch -d codex/fullsite-ux-audit
git branch -d codex/fullsite-ux-audit-2026
git branch -d codex/home-cro-2026
git branch -d codex/home-cro-pass2
git branch -d codex/home-cro-pass3
git branch -d codex/nivel-dios-crm-automation
git branch -d codex/ux-ui-cro-audit-20260209
git branch -d CURSOR-GUSTAVO
```

Resultado:

```text
Deleted branch codex/crm-trial-checkout (was 02c8f9a).
Deleted branch codex/fix-conekta-payments (was b6a9201).
Deleted branch codex/fullsite-ux-audit (was 8589c80).
Deleted branch codex/fullsite-ux-audit-2026 (was 534e17c).
Deleted branch codex/home-cro-2026 (was c5e8c4e).
Deleted branch codex/home-cro-pass2 (was d92bee9).
Deleted branch codex/home-cro-pass3 (was eb80456).
Deleted branch codex/nivel-dios-crm-automation (was ff6282b).
Deleted branch codex/ux-ui-cro-audit-20260209 (was 2431193).
Deleted branch CURSOR-GUSTAVO (was 2431193).
```

### Comandos Ejecutados (remoto origin)

```text
git push origin --delete allow-non-admin-to-find-video-config
git push origin --delete backend
git push origin --delete codex/home-cro-2026
git push origin --delete CURSOR-GUSTAVO
git push origin --delete fix-anual-subscribers-renowal
git push origin --delete fixing-bad-subscriptions
git push origin --delete fixing-orders-not-being-marked-as-failed
git push origin --delete jorge
git push origin --delete list-of-allowed-countries
git push origin --delete redirecting-users-with-plan-to-upgrade-plan-page
git push origin --delete select-user-type-when-creating-new-user
git push origin --delete test
git push origin --delete uh-migration
```

Resultado (resumen):

```text
- [deleted] allow-non-admin-to-find-video-config
- [deleted] backend  (GitHub mostró “Bypassed rule violations … Cannot delete this branch”, pero la referencia se eliminó)
- [deleted] codex/home-cro-2026
- [deleted] CURSOR-GUSTAVO
- [deleted] fix-anual-subscribers-renowal
- [deleted] fixing-bad-subscriptions
- [deleted] fixing-orders-not-being-marked-as-failed
- [deleted] jorge
- [deleted] list-of-allowed-countries
- [deleted] redirecting-users-with-plan-to-upgrade-plan-page
- [deleted] select-user-type-when-creating-new-user
- [deleted] test
- [deleted] uh-migration
```

### Post-Cleanup Snapshot

```text
$ git fetch --all --prune
(sin output)

$ git branch -vv
* main    1283acc [origin/main] docs: sync audit stats
  staging 68687ea [origin/staging] fix(home): cleaner conversion copy, mobile type, cover hero

$ git branch -a
* main
  staging
  remotes/origin/HEAD -> origin/main
  remotes/origin/adding-phone-number-to-manychat
  remotes/origin/filter-orders-by-email-and-phone
  remotes/origin/folderDownload
  remotes/origin/main
  remotes/origin/staging

$ git remote show origin
Remote branches:
  adding-phone-number-to-manychat  tracked
  filter-orders-by-email-and-phone tracked
  folderDownload                   tracked
  main                             tracked
  staging                          tracked
```

## Deep Review (Ramas Remotas Restantes en origin)

Objetivo: decidir con evidencia si es **seguro borrar** las ramas remotas que quedaron en `REVIEW`.

### origin/adding-phone-number-to-manychat

Evidencia:

```text
$ git log -1 --format="%ci | %an | %s" origin/adding-phone-number-to-manychat
2024-05-06 16:40:08 -0700 | Luis Salcido | When creating a user in manychat we add phone number as custom field

$ git rev-list --left-right --count origin/main...origin/adding-phone-number-to-manychat
381	1

$ git merge-base --is-ancestor origin/adding-phone-number-to-manychat origin/main
exit=1  (NO merged por ancestry)

$ git cherry -v origin/main origin/adding-phone-number-to-manychat
+ 289b65f26d7faf9f5031f8c70442d012e398ec89 When creating a user in manychat we add phone number as custom field

$ git diff --stat origin/main...origin/adding-phone-number-to-manychat
 backend/src/many-chat/index.ts | 15 +++++++++++++--
 1 file changed, 13 insertions(+), 2 deletions(-)

$ gh pr list --state all --head adding-phone-number-to-manychat
[]
```

Veredicto: **REVIEW**

Razón: la rama contiene **1 patch único no integrado** en `origin/main` (git cherry `+`). No hay PR asociado. Decide si se rescata via PR/cherry-pick o si se elimina como deuda histórica.

Plan sugerido:
- Si el cambio sigue siendo deseado (ManyChat debe guardar teléfono), abrir PR o cherry-pick a `main`, y luego borrar la rama.
- Si ya no se usa ManyChat o el flujo cambió, borrar la rama remota.

### origin/filter-orders-by-email-and-phone

Evidencia:

```text
$ git log -1 --format="%ci | %an | %s" origin/filter-orders-by-email-and-phone
2024-04-04 13:16:03 -0700 | Luis Salcido | Merge branch 'main' into filter-orders-by-email-and-phone

$ git rev-list --left-right --count origin/main...origin/filter-orders-by-email-and-phone
575	2

$ git merge-base origin/main origin/filter-orders-by-email-and-phone
903db103d1af9c55c24995c53c58cd35ad9c1e15

$ git rev-parse 903db103d1af9c55c24995c53c58cd35ad9c1e15^{tree}
15873811c23a401e5299f55ff2da5078479e1533

$ git rev-parse origin/filter-orders-by-email-and-phone^{tree}
15873811c23a401e5299f55ff2da5078479e1533

$ git diff --stat origin/main...origin/filter-orders-by-email-and-phone
(sin diferencias; tree igual al merge-base)

$ git log --oneline origin/main..origin/filter-orders-by-email-and-phone
bd01f11 (origin/filter-orders-by-email-and-phone) Merge branch 'main' into filter-orders-by-email-and-phone
32a1cb9 Merge branch 'backend' into filter-orders-by-email-and-phone

$ gh pr list --state all --head filter-orders-by-email-and-phone
[]
```

Veredicto: **SAFE TO DELETE (remoto origin)**, con evidencia adicional.

Razón: aunque tiene `ahead=2`, son **merge commits** y el **árbol de la rama es idéntico al merge-base** con `origin/main` (no hay cambios efectivos que conservar). No hay PR asociado.

### origin/folderDownload

Evidencia:

```text
$ git log -1 --format="%ci | %an | %s" origin/folderDownload
2024-02-15 13:17:51 -0700 | loretoInowu | console logged state objects to test them from a button

$ git rev-list --left-right --count origin/main...origin/folderDownload
695	1

$ git merge-base --is-ancestor origin/folderDownload origin/main
exit=1  (NO merged por ancestry)

$ git cherry -v origin/main origin/folderDownload
+ a27012cc9a50b1f9dc773e0442a3eb29fc1fd1ed console logged state objects to test them from a button

$ git diff --stat origin/main...origin/folderDownload
 frontend/package.json            |  1 +
 frontend/src/index.tsx           | 28 +++++++++++++++-------------
 frontend/src/pages/Home/Home.tsx | 29 +++++++++++++++++++++++++++++
 3 files changed, 45 insertions(+), 13 deletions(-)

$ gh pr list --state all --head folderDownload
[]
```

Veredicto: **REVIEW**

Razón: la rama contiene **1 patch único no integrado** en `origin/main` (git cherry `+`) y el último commit sugiere cambios de prueba/debug. No hay PR asociado.

Plan sugerido:
- Si el cambio era experimental y no se necesita: borrar rama remota.
- Si sí aporta funcionalidad: abrir PR o cherry-pick a `main`, y luego borrar la rama.

## Recomendación Actualizada (Post-Cleanup)

SAFE TO DELETE NOW (remoto origin):
- (ninguna)

DELETED (remoto origin, ejecutado 2026-02-09):
- `filter-orders-by-email-and-phone`

REVIEW (remoto origin):
- `adding-phone-number-to-manychat` (1 patch único)
- `folderDownload` (1 patch único)

DO NOT DELETE:
- `main`, `staging`, `origin/main`, `origin/staging`

## Post-Cleanup (Ejecutado 2026-02-09)

```text
$ git push origin --delete filter-orders-by-email-and-phone
- [deleted]         filter-orders-by-email-and-phone

$ git branch -a
* main
  staging
  remotes/origin/HEAD -> origin/main
  remotes/origin/adding-phone-number-to-manychat
  remotes/origin/folderDownload
  remotes/origin/main
  remotes/origin/staging
```
