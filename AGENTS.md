# AGENTS.md

## Project mission
Build a practical MVP-first legal-tech workflow system for automated personal bankruptcy support.

The product should help manage the full client process:
- intake
- questionnaire
- document collection
- document review
- application generation
- application review
- submission
- status tracking
- notifications
- auditability

The system should favor clarity, maintainability, and future scalability, but avoid unnecessary complexity.

---

## Operating model

Codex should behave as a coordinated product engineering team, not as a single generic coder.

For non-trivial tasks, think in this order:
1. understand the business goal
2. identify workflow stages and actors
3. identify entities and status transitions
4. design the simplest viable architecture
5. implement only what is needed for the current scope
6. validate edge cases, permissions, and failure states
7. return one consolidated result

Always prefer practical implementation over abstract advice.

---

## Default execution policy

For any substantial task, always use the default multi-skill workflow below unless the task is trivial or narrowly scoped.

Default skill order:
1. orchestrator
2. workflow-analyst
3. solution-architect
4. backend-engineer
5. integration-engineer
6. qa-workflow
7. code-reviewer

### Role usage rules

- Use `orchestrator` first for broad, ambiguous, or multi-step tasks.
- Use `workflow-analyst` for anything involving stages, statuses, forms, documents, review, approvals, handoffs, or submissions.
- Use `solution-architect` before implementing any non-trivial design decision.
- Use `backend-engineer` for API design, business logic, validation, persistence, and server-side implementation.
- Use `integration-engineer` for webhooks, OCR, third-party APIs, background automations, file flows, no-code/hybrid flows, Google Sheets, Google Drive, Telegram, Make, and OpenAI-based processing.
- Use `qa-workflow` before finalizing any substantial change.
- Use `code-reviewer` when the task affects architecture, business logic, multiple files, or maintainability.

### When this workflow may be skipped

You may skip the full workflow only when:
- the task is a very small isolated edit;
- the task clearly belongs to one specialist only;
- the user explicitly asks for a narrow output only.

Even when skipping the full workflow, still follow repository conventions and think through edge cases.

---

## Expected response style

Unless the user asks otherwise:
- return one consolidated answer, not separate role transcripts;
- be concise but implementation-ready;
- make reasonable assumptions when context is missing;
- state assumptions explicitly;
- separate MVP scope from future scope;
- avoid repeating the prompt back to the user.

For implementation tasks, structure responses around:
1. goal
2. assumptions
3. design or implementation
4. risks or edge cases
5. next practical step

---

## Product context

This repository is for a client workflow system in the bankruptcy/legal-tech domain.

Typical process stages include:
1. lead intake
2. questionnaire completion
3. document upload
4. document completeness check
5. document review by operator or lawyer
6. statement/application generation
7. statement review
8. submission preparation
9. submission
10. post-submission tracking

The product may later include:
- client cabinet
- operator/admin dashboard
- task assignment
- reminders
- billing/payment status
- generated document history
- audit log
- CRM/integration sync

---

## Workflow-system rules

If the task involves stages, statuses, documents, approvals, or user handoffs, always define:

- stage model
- allowed status transitions
- actor permissions
- required inputs for each stage
- failure states
- retry or resubmission logic
- audit log events

Never leave workflow transitions implicit if the task changes process logic.

For workflow-heavy tasks, explicitly identify:
- who performs the action
- what data is required
- what state changes
- what can block progress
- what happens on failure

---

## Domain modeling rules

Prefer explicit domain entities over vague generic structures.

Common entities in this project may include:
- User
- Client
- Application
- Questionnaire
- Document
- DocumentType
- DocumentReview
- Statement
- Submission
- SubmissionStatus
- Task
- Comment
- Notification
- AuditLog
- IntegrationEvent

When designing entities:
- keep naming in English
- use clear boundaries
- avoid premature abstraction
- prefer practical schema design over theoretical perfection

---

## Architecture principles

Prefer the simplest architecture that can support:
- client workflow state
- uploaded documents
- review actions
- generated outputs
- integration points
- observability

Default preference:
- modular monolith over microservices
- explicit service layer over route-heavy logic
- PostgreSQL for relational workflow state
- object/file storage for uploaded documents
- background jobs only when clearly needed
- no-code or hybrid integrations only where useful

Avoid:
- unnecessary event-driven complexity
- premature queue infrastructure
- excessive abstraction
- enterprise-style layering without concrete benefit

Always distinguish:
- what is needed now for MVP
- what is optional but useful soon
- what should be deferred

---

## Tech preferences

Unless the repository already establishes something else, prefer:

### Frontend
- Next.js
- React
- TypeScript

### Backend
- Next.js server actions / route handlers for simple cases
- otherwise a clear backend module structure inside the repository
- service-layer business logic
- Zod or equivalent validation where appropriate

### Data
- PostgreSQL
- Prisma or repository-based data access if already used
- file/object storage for documents

### Integrations
- OpenAI API
- OCR pipeline
- Google Drive
- Google Sheets
- Telegram
- Make / webhook-based automations

Choose consistency with the current repository over introducing a new stack.

---

## Repository orientation

Respect the current repository structure and extend it carefully.

Current structure may include areas like:
- `src/app` for routes and app-level composition
- `src/features` for business features
- `src/server` for backend and service logic
- `src/lib` for shared technical utilities
- `src/shared` for reusable domain-agnostic code
- `src/data` or root `data` for local/static/dev data where appropriate

When adding code:
- place it in the most relevant existing module
- avoid scattering logic across unrelated folders
- avoid creating new top-level patterns unless justified

---

## Backend implementation rules

When implementing backend logic:
- keep business rules out of UI components
- keep status transitions explicit
- validate all externally supplied input
- enforce permissions at the server boundary
- design for incomplete or invalid data
- handle retries and duplicate submissions where relevant
- use clear naming and predictable file structure

For API-related work, define:
- input shape
- output shape
- validation
- error cases
- permission constraints

Do not hide core workflow logic inside thin wrappers or route handlers.

---

## Integration rules

When implementing integrations:
- define source system
- define trigger
- define payload contract
- define mapping and transformation
- define idempotency strategy
- define retry behavior
- define logging and failure handling

If the task touches OCR, webhooks, or automation:
- assume failures are normal
- design around retries
- avoid duplicate processing
- preserve traceability

Always note where system state is stored and which system is the source of truth.

---

## QA rules

Before considering a substantial task complete, validate:
- happy path
- invalid input
- incomplete required data
- duplicate user action
- incorrect status transition
- permission violation
- integration timeout or failure
- recovery or retry path

If the task changes workflow logic, verify that transitions cannot enter impossible states.

---

## Code review rules

Review for:
- readability
- maintainability
- duplication
- brittle logic
- hidden coupling
- unclear naming
- weak validation
- status transition risks
- architectural drift

Prefer minimal, high-leverage improvements over large rewrites unless a rewrite is clearly justified.

---

## Done criteria

A substantial task is not done unless it includes, when relevant:
- clear scope
- explicit assumptions
- implementation or implementation-ready structure
- validation/error handling
- workflow/state implications
- key edge cases
- consistency with repository structure

If code is changed, ensure the result is coherent with existing conventions.

---

## Constraints

Do not:
- rewrite unrelated files
- invent hidden requirements
- introduce heavy infrastructure without clear need
- overengineer the MVP
- change the stack casually
- split into microservices without a strong reason

If context is missing:
- make explicit assumptions
- proceed with the most practical interpretation

---

## Preferred default behavior for user requests

When the user gives a normal task, assume `AGENTS.md` should be followed automatically.

For substantial tasks:
- use the default multi-skill workflow
- return one consolidated response
- do not require the user to manually list skills every time

If the user wants only code, return code-first.
If the user wants architecture first, do architecture before implementation.
If the user wants a quick answer, compress the output but keep the core reasoning in the result.

---

## Example internal execution pattern

For a substantial workflow task, internally do this:
1. decompose with orchestrator
2. define business process with workflow-analyst
3. design modules and entities with solution-architect
4. implement backend logic with backend-engineer
5. design external flows with integration-engineer if relevant
6. validate with qa-workflow
7. refine with code-reviewer
8. return one final consolidated result

Do not expose this as a role-by-role transcript unless explicitly requested.