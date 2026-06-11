---
name: loop-code-review
description: Iterative code-review workflow for active git changes using independent reviewer sub-agents. Use when the user invokes `/loop-code-review`, asks for a looped sub-agent code review, or asks Claude Code to keep reviewing and fixing changes until an independent reviewer either rates the result at least 9.5 out of 10 or reports no actionable comments. When the worktree is clean, falls back to reviewing the latest commit (or the branch-vs-base diff).
---

# Loop Code Review

## Overview

Run an iterative review-and-fix loop over the current git changes. Spawn independent, read-only reviewer sub-agents via the `Agent` tool, address actionable findings, validate the result, and repeat until a fresh reviewer scores the latest state at least 9.5/10 or explicitly reports no actionable findings.

## Review Scope Selection

Determine what to review before spawning any reviewer:

1. If `git status --short` shows staged, unstaged, or relevant untracked changes, the **review scope is the active worktree changes** (`git diff`, `git diff --cached`, and untracked files).
2. If the worktree is clean, fall back in this order and state which you picked:
   - the branch-vs-base diff (`git diff <base>...HEAD`, where `<base>` is the default branch such as `main`), if it is non-empty;
   - otherwise the latest commit (`git show HEAD`).
3. If there is genuinely nothing to review (clean worktree, no diff vs base, empty/initial commit), say so and stop — do not invent work.

## Sub-agent Context Isolation

Independent review means the reviewer shares the filesystem and repository state but must NOT inherit the parent thread's conversation history, reasoning, assumptions, or prior review discussion.

- Spawn each reviewer with a fresh `Agent` call (a new sub-agent context), not by forwarding parent context.
- Pass a self-contained reviewer prompt: repository path, exact review scope (the git command(s) that define it), and validation expectations only.
- Do NOT include parent-thread analysis, implementation rationale, suspected issues, proposed fixes, previous reviewer output, or summaries of the main process's reasoning.
- Require the reviewer to inspect `git status`, diffs, files, and validation output itself before scoring.
- Treat every scoring pass as coming from a brand-new reviewer with no parent context.

## Reviewer Agent Configuration

- Use the `Agent` tool with a read-only-capable reviewer. Prefer `subagent_type: "Plan"` (read-only: no Edit/Write/NotebookEdit, but can run commands and validation) or `subagent_type: "general-purpose"` with an explicit read-only instruction in the prompt.
- Use the most capable available model with high reasoning effort (e.g. `model: "opus"`).
- Run reviewers in the foreground so each result gates the next step.

## Workflow

1. Inspect the worktree and select the review scope (see above). Preserve unrelated user changes; do not stage, commit, reset, stash, or push unless the user explicitly asks.

2. Spawn one independent reviewer sub-agent for the selected scope.
   - Give it only the self-contained task prompt (repo path, scope, validation expectations).
   - Ask it to stay read-only, inspect the changes independently, prioritize bugs and regressions, and return findings with file/line references.
   - Require a final numeric score from 1 to 10 for the current state.

3. Treat reviewer output as findings, not orders.
   - Fix concrete, actionable issues affecting correctness, security, data integrity, UX, maintainability, or test coverage.
   - If a finding is wrong, stale, or conflicts with the architecture, explain the decision in the main thread instead of blindly applying it.
   - If the reviewer scores below 9.5 but explicitly reports no actionable findings, accept that as a valid stop signal rather than chasing score-only polish.
   - If the reviewer scores below 9.5 and implies unresolved concerns without listing them, ask once for specific blocking issues; if none come, spawn a fresh reviewer rather than inventing polish work.

4. Validate after each meaningful fix.
   - Run the smallest meaningful tests, typecheck, lint, build, or focused scripts for the touched surface.
   - Fix any validation failure before requesting another final score.
   - A 9.5+ score or no-actionable-findings review does NOT count while local validation is red.

5. Repeat.
   - Spawn a NEW independent reviewer after each round of fixes. Every scoring pass uses a fresh sub-agent.
   - Continue until validation for the changed surface passes AND the latest reviewer scores ≥ 9.5/10 or explicitly reports no actionable findings.
   - Exit early only if blocked by higher-priority instructions, missing tool capability, user interruption, or a risk requiring explicit user approval.

## Reviewer Prompt Template

Adjust the scope line to match the selected review scope:

```text
Review the following git changes in the repository at <REPO_PATH> independently. You do NOT have any parent conversation history; do not rely on prior chat, parent-agent conclusions, or previous reviewer output. Derive findings only from the repository state and command output you inspect yourself. Stay strictly read-only: do not edit, stage, commit, reset, stash, or push.

Review scope: <SCOPE> (e.g. "the active worktree changes shown by `git status --short`, `git diff`, and `git diff --cached`" OR "the latest commit shown by `git show HEAD`" OR "`git diff main...HEAD`").

Prioritize correctness bugs, behavioral regressions, security/privacy issues, data integrity problems, missing high-value tests, and maintainability risks introduced by these changes. Ignore unrelated pre-existing issues unless the changes make them worse.

Return findings first, ordered by severity, each with concrete file/line references and a short explanation of user impact. If there are no actionable findings, say so clearly. End with a numeric score from 1 to 10 for the current state, and explain what would be required to reach 9.5/10 if anything remains.
```

## Final Response

When the loop finishes, report:

- what changed and why (or that no changes were needed);
- the review scope that was used;
- the reviewer acceptance signal: score ≥ 9.5/10, no actionable findings, or both;
- validation commands and results;
- any findings intentionally not changed, with the reason;
- remaining risks or follow-up work, if any.
