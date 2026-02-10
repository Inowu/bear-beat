# Branch Audit

- Generated: 2026-02-10 10:18:56
- Base branch (origin/HEAD): `origin/main`

## Summary

This repo currently has 10 local branches and 11 remote branches under `origin/*` (excluding `origin/HEAD`).

## Recommendations

### SAFE TO DELETE NOW

Local branches:
- `codex/home-polish-2026-02-10`

Remote branches (origin):
- `codex/home-polish-2026-02-10`

### KEEP

- `main`
- `origin/main`
- `staging`
- `origin/staging`

### REVIEW

- `codex/home-demo-playback-2026-02-10`
- `prod-audit-uxui-cro-2026-02-10`
- `origin/adding-phone-number-to-manychat`
- `origin/codex/home-demo-playback-2026-02-10`
- `origin/folderDownload`
- `origin/prod-audit-uxui-cro-2026-02-10`

### DO NOT DELETE

- `codex/auth-login-polish-2026-02-10`
- `codex/branch-audit-2026-02-10`
- `codex/home-planes-demo-fixes-2026-02-10`
- `codex/legal-polish-2026-02-10`
- `ux-ui-cro-feb-2026`
- `origin/codex/auth-login-polish-2026-02-10`
- `origin/codex/home-planes-demo-fixes-2026-02-10`
- `origin/codex/legal-polish-2026-02-10`
- `origin/ux-ui-cro-feb-2026`

## Inventory (Per Ref)

| branch_name | ref_type | upstream | last_commit_date | last_commit_author | last_commit_subject | ahead/behind vs origin/main | merged_into_base? | has_pr? | pr_state | url | recommendation | reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| main | local | origin/main | 2026-02-10 09:02:20 -0500 | djkubo | Merge pull request #60 from Inowu/codex/home-polish-2026-02-10 | ahead:0 behind:0 | yes | no |  |  | KEEP | Rama long-lived / base. |
| origin/main | remote |  | 2026-02-10 09:02:20 -0500 | djkubo | Merge pull request #60 from Inowu/codex/home-polish-2026-02-10 | ahead:0 behind:0 | yes | no |  |  | KEEP | Rama long-lived / base. |
| codex/auth-login-polish-2026-02-10 | local | origin/codex/auth-login-polish-2026-02-10 | 2026-02-10 09:54:52 -0500 | Gustavo Garcia | fix(auth): align signup UI with login form | ahead:3 behind:0 | no | yes | OPEN | https://github.com/Inowu/bear-beat/pull/62 | DO NOT DELETE | PR OPEN asociado. |
| codex/branch-audit-2026-02-10 | local | origin/main | 2026-02-10 09:02:20 -0500 | djkubo | Merge pull request #60 from Inowu/codex/home-polish-2026-02-10 | ahead:0 behind:0 | yes | no |  |  | DO NOT DELETE | Rama en uso por un worktree activo. |
| codex/home-planes-demo-fixes-2026-02-10 | local | origin/codex/home-planes-demo-fixes-2026-02-10 | 2026-02-10 10:12:07 -0500 | Gustavo Garcia | fix(planes): simplify layout + clarify trial copy | ahead:3 behind:0 | no | yes | OPEN | https://github.com/Inowu/bear-beat/pull/63 | DO NOT DELETE | PR OPEN asociado. |
| codex/legal-polish-2026-02-10 | local | origin/codex/legal-polish-2026-02-10 | 2026-02-10 09:21:26 -0500 | Gustavo Garcia | feat(legal): accessible TOC + FAQ accordion + schema | ahead:1 behind:0 | no | yes | OPEN | https://github.com/Inowu/bear-beat/pull/61 | DO NOT DELETE | PR OPEN asociado. |
| ux-ui-cro-feb-2026 | local | origin/ux-ui-cro-feb-2026 | 2026-02-09 21:27:50 -0500 | Gustavo Garcia | chore: branch audit + cleanup plan (dry-run) | ahead:5 behind:10 | no | yes | OPEN | https://github.com/Inowu/bear-beat/pull/57 | DO NOT DELETE | PR OPEN asociado. |
| origin/codex/auth-login-polish-2026-02-10 | remote |  | 2026-02-10 09:54:52 -0500 | Gustavo Garcia | fix(auth): align signup UI with login form | ahead:3 behind:0 | no | yes | OPEN | https://github.com/Inowu/bear-beat/pull/62 | DO NOT DELETE | PR OPEN asociado. |
| origin/codex/home-planes-demo-fixes-2026-02-10 | remote |  | 2026-02-10 10:12:07 -0500 | Gustavo Garcia | fix(planes): simplify layout + clarify trial copy | ahead:3 behind:0 | no | yes | OPEN | https://github.com/Inowu/bear-beat/pull/63 | DO NOT DELETE | PR OPEN asociado. |
| origin/codex/legal-polish-2026-02-10 | remote |  | 2026-02-10 09:21:26 -0500 | Gustavo Garcia | feat(legal): accessible TOC + FAQ accordion + schema | ahead:1 behind:0 | no | yes | OPEN | https://github.com/Inowu/bear-beat/pull/61 | DO NOT DELETE | PR OPEN asociado. |
| origin/ux-ui-cro-feb-2026 | remote |  | 2026-02-09 21:27:50 -0500 | Gustavo Garcia | chore: branch audit + cleanup plan (dry-run) | ahead:5 behind:10 | no | yes | OPEN | https://github.com/Inowu/bear-beat/pull/57 | DO NOT DELETE | PR OPEN asociado. |
| staging | local | origin/staging | 2026-02-08 18:48:29 -0500 | Gustavo Garcia | fix(home): cleaner conversion copy, mobile type, cover hero | ahead:0 behind:23 | yes | no |  |  | KEEP | Rama long-lived / base. |
| origin/staging | remote |  | 2026-02-08 18:48:29 -0500 | Gustavo Garcia | fix(home): cleaner conversion copy, mobile type, cover hero | ahead:0 behind:23 | yes | no |  |  | KEEP | Rama long-lived / base. |
| codex/home-demo-playback-2026-02-10 | local | origin/codex/home-demo-playback-2026-02-10 | 2026-02-10 03:06:27 -0500 | Gustavo Garcia | fix(auth): respetar redirect state en NotAuthRoute | ahead:15 behind:9 | no | yes | MERGED | https://github.com/Inowu/bear-beat/pull/59 | REVIEW | No está integrada a la base; requiere revisión. |
| prod-audit-uxui-cro-2026-02-10 | local | origin/prod-audit-uxui-cro-2026-02-10 | 2026-02-09 22:43:56 -0500 | Gustavo Garcia | chore(audit): refresh local artifacts (post-fix rerun) | ahead:7 behind:10 | no | yes | MERGED | https://github.com/Inowu/bear-beat/pull/58 | REVIEW | No está integrada a la base; requiere revisión. |
| origin/adding-phone-number-to-manychat | remote |  | 2024-05-06 16:40:08 -0700 | Luis Salcido | When creating a user in manychat we add phone number as custom field | ahead:1 behind:392 | no | no |  |  | REVIEW | No está integrada a la base; requiere revisión. |
| origin/codex/home-demo-playback-2026-02-10 | remote |  | 2026-02-10 03:06:27 -0500 | Gustavo Garcia | fix(auth): respetar redirect state en NotAuthRoute | ahead:15 behind:9 | no | yes | MERGED | https://github.com/Inowu/bear-beat/pull/59 | REVIEW | No está integrada a la base; requiere revisión. |
| origin/folderDownload | remote |  | 2024-02-15 13:17:51 -0700 | loretoInowu | console logged state objects to test them from a button | ahead:1 behind:706 | no | no |  |  | REVIEW | No está integrada a la base; requiere revisión. |
| origin/prod-audit-uxui-cro-2026-02-10 | remote |  | 2026-02-09 22:43:56 -0500 | Gustavo Garcia | chore(audit): refresh local artifacts (post-fix rerun) | ahead:7 behind:10 | no | yes | MERGED | https://github.com/Inowu/bear-beat/pull/58 | REVIEW | No está integrada a la base; requiere revisión. |
| codex/home-polish-2026-02-10 | local | origin/codex/home-polish-2026-02-10 | 2026-02-10 08:58:37 -0500 | Gustavo Garcia | fix(a11y): remove nested main + proper lists; signup default to /planes | ahead:0 behind:1 | yes | yes | MERGED | https://github.com/Inowu/bear-beat/pull/60 | SAFE TO DELETE | Ya está integrada en la base (merge-base). |
| origin/codex/home-polish-2026-02-10 | remote |  | 2026-02-10 08:58:37 -0500 | Gustavo Garcia | fix(a11y): remove nested main + proper lists; signup default to /planes | ahead:0 behind:1 | yes | yes | MERGED | https://github.com/Inowu/bear-beat/pull/60 | SAFE TO DELETE | Ya está integrada en la base (merge-base). |
