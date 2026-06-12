# Agent Core Workflow

Before changing code:

- Inspect current files, logs, docs, and behavior before changing code.
- Map current behavior against intended target behavior.
- Plan the change, including exact files to add/edit and why.
- Run a pre-mortem with concrete risks and mitigations.

While changing code:

- Implement in small slices.
- Test with focused checks and live CLI/TUI prompts when relevant.
- Update docs and Linear, or local planning docs if Linear is unavailable.

For every plan, include:

- Issue being solved.
- Root cause from inspection.
- Intended behavior.
- Files added/edited with reasons.
- Step-by-step implementation.
- Risks/premortem.
- Tests to run.
- Dogfood/JSONL verification plan.
- Rollback or follow-up decision point.
