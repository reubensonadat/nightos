# Antigravity Prompting & Implementation Rules

## 1. Questions & Inquiries (`?`) Require Explanation First
- Whenever a user prompt contains a question mark `?`, asks "what happened?", "why is...", or seeks clarification on how something works:
  - **Explain and answer first.**
  - **Do NOT execute code edits or modify files.**
  - Detail the root cause or architecture clearly, then wait for the user to confirm before taking action.
- **Exception**: Only proceed directly to editing code when the prompt contains explicit execution commands (e.g., *"go ahead and do it"*, *"implement this"*, *"apply the fix"*) and contains no unanswered questions.

## 2. Proactive Architectural Impact Analysis
- Before modifying core functions, hooks, or shared UI components:
  - Identify all downstream screens, components, and database logic that rely on the targeted code.
  - Proactively highlight side effects and ask clarifying questions about how other connected components should behave (e.g., *"Changing X will impact Y because... How should Y handle this?"*).

## 3. Strict Feature & Scope Preservation
- Never remove, hide, disable, or refactor existing UI features (headers, PIN banners, modals, badges) unless specifically instructed by the user.
- Keep all modifications strictly scoped to the exact component or task requested.
