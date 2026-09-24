# Agent Directives & Anti-Regression Protocols

## 1. Impact Analysis & Proactive Testing Notifications
Whenever making code modifications in this project:
- **Side-Effect Audit**: Evaluate every adjacent component, shared state hook, database schema, or model selector that might be influenced by the change.
- **Proactive User Test Notifications**: If a change touches shared infrastructure (e.g. `AppContext`, `platformSettings`, `auth`, `aiAgent`, `save` handlers, or model configs), the agent MUST provide the user with a **"Recommended Test Checklist"** listing any non-obvious areas that could be impacted and the exact technical reason why.
- **No Silent Collateral Modifications**: Never touch, revert, or simplify working features, saving logic, or AI model configurations unless explicitly requested by the user.

## 2. Single Source of Truth
- Never introduce hardcoded inline fallback values for settings, models, or plan configs across separate component files.
- Always inspect existing global constants and data contracts before modifying data structures.

## 3. Strict Code Non-Truncation & Verification
- **Zero Truncation Rule**: Never use placeholder comments (e.g. `// ... rest of code unchanged ...`), omit function blocks, or accidentally drop existing code during edits.
- **Post-Edit Integrity Audit**: Every file modification must use exact line-range targeting (`replace_file_content` / `multi_replace_file_content`) and be verified via diff inspection or line count comparison to guarantee that zero existing lines, comments, imports, or handlers were truncated or lost.

## 4. Platform Uniformity & Multi-Instance Synchronization
- **Multi-Instance Audit**: Whenever making adjustments to a UI component, viewer, editor, document renderer (PDF, HTML, canvas, print layout), email composer/template, modal, data handler, or calculation, perform a codebase search to find all other instances or implementations of that same functionality.
- **Synchronized Platform Uniformity**: Update all matching instances across the codebase to keep behavior, calculations, and visuals uniform.
- **Instance Disclosure & Confirmation Prompt**: Clearly report all identified alternate instances in the response and ask the user if they would like those instances updated as well.

## 5. Firebase Environment Verification & Multi-Workspace Safety
- **Cross-Workspace State Verification**: The `firebase-mcp-server` maintains persistent memory across IDE sessions.
- **Mandatory Pre-Deployment Audit**: Before executing any `firebase_deploy` or Firestore operations, the agent MUST run `firebase_get_environment` to verify that `project_dir` matches `TekTrakker-v2` and `active_project` matches `tektrakker`.
- **Auto-Sync**: If mismatched, the agent MUST call `firebase_update_environment` to sync the directory and project before deploying.

