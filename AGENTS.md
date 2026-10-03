# Workspace Agent Rules

These rules govern all AI coding actions within this workspace:

## 1. Questions & Inquiries (`?`) Require Explanation First
- Whenever a user prompt contains a question mark `?`, asks "what happened?", "why is...", or seeks clarification:
  - **Explain and answer first.**
  - **Do NOT execute code edits or mutate files.**
  - Explain the root cause, logic, or structure first. Wait for the user's go-ahead before implementing.
- **Direct Implementation Only On Explicit Commands**: Only jump directly to editing code when the prompt contains explicit execution language without open questions (e.g., *"go ahead and do it"*, *"implement this"*, *"apply the fix"*).

## 2. Proactive Architectural Impact Analysis & Questions
- When implementing a feature or refactoring existing logic:
  - Analyze how the change affects other components, screens, hooks, or backend tables that depend on it.
  - Proactively point out potential side-effects and ask clarifying questions where there are architectural trade-offs.

## 3. Strict Feature & Scope Preservation
- Never remove, hide, or refactor unrelated UI components (such as headers, Table PIN banners, modals, badges, or layouts) without explicit instructions.
