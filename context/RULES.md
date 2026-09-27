# RULES — Coding Standards & Architecture Rules

> **Purpose:** Specify project coding rules, language standards, architecture guidelines, and design principles so all generated code is clean, consistent, and maintainable. Tier-3 template — fill it in for your project.

_Last updated: September 12, 2026_

---

## 1. Language & TypeScript Standards

MIMAWorks AI uses TypeScript throughout the stack for type safety and improved developer experience.

- **TypeScript Strict Mode:** Mandatory `strict: true` in `tsconfig.json`. No `any` types allowed without explicit review comments explaining why they're necessary and temporary.
- **Type Declarations Location:** Store shared domain types in `src/types/` organized by domain (e.g. `src/types/user.ts`, `src/types/job.ts`, `src/types/match.ts`). Avoid inline type duplication.
- **Type vs. Interface:** Consistently prefer `type` for object and utility definitions. Reserve `interface` only for declaration merging or class interface contracts.
- **Naming:** Use descriptive, intent-revealing names. Avoid single-letter variables except for conventional loop indices.
- **Formatting:** Use Prettier with ESLint for consistent code formatting. Enable `eslint:recommended` and `@typescript-eslint/recommended` plugins.
- **Dependencies:** Prefer native TypeScript features over external libraries when possible (e.g., built-in utility types vs. lodash/fp).

---

## 2. Naming Conventions (Files & Code)

Consistent naming improves code readability and maintainability.

- **Files & Directories:** 
  - `kebab-case` for utility files, helpers, and documentation (e.g. `date-utils.ts`)
  - `PascalCase` for React components (e.g. `UserProfile.tsx`)
  - `kebab-case` for non-component files and directories
- **Variables & Functions:** 
  - `camelCase` for variables, function names, and properties (e.g. `calculateMatchScore`)
  - `PascalCase` for classes, types, and interfaces
  - `UPPER_SNAKE_CASE` for global constants (e.g. `MAX_RECOMMENDATIONS`)
- **Intent-Revealing Names:** 
  - Names must answer why an entity exists and what it does
  - Avoid generic noise suffixes (`Manager`, `Data`, `Helper`, `Utils`)
  - Avoid obscure abbreviations; prefer clarity over brevity
  - Boolean variables should be prefixed with `is`, `has`, `should`, or `can` (e.g., `isAuthenticated`, `hasSkills`)

---

## 3. SOLID Principles Application

We apply SOLID principles to create maintainable, flexible code.

- **Single Responsibility Principle (SRP):** 
  - Each function/class has one reason to change
  - Separate UI presentation from business logic (presentation layer vs domain layer)
  - Components should focus on UI rendering, delegating business logic to services/hooks
  - Services should have a single domain responsibility (e.g., `AuthService` handles only authentication)
- **Open/Closed Principle (OCP):** 
  - Extend functionality through composition or strategy patterns rather than mutating established core functions
  - Use plugin-like architectures for extensible features (e.g., different matching algorithms)
  - Prefer inheritance over modification when extending behavior
- **Liskov Substitution Principle (LSP):** 
  - Subtypes or interface implementations must be drop-in replaceable without breaking caller expectations
  - When implementing interfaces, ensure all implementations honor the contract
  - Use unit tests to verify substitutability of implementations
- **Interface Segregation Principle (ISP):** 
  - Prefer small, specific interfaces over bloated multi-purpose interfaces
  - Split large interfaces into smaller, cohesive ones based on client usage
  - Clients should not be forced to depend on methods they don't use
- **Dependency Inversion Principle (DIP):** 
  - Depend upon abstractions (interfaces/types), not concrete implementations
  - Pass dependencies into functions/classes rather than creating them internally (dependency injection)
  - Use dependency injection containers or factory patterns for complex object graphs

---

## 4. DRY & KISS Guidelines

Balance code reuse with simplicity.

- **DRY (Don't Repeat Yourself):** 
  - Extract a shared abstraction only when a pattern genuinely repeats multiple times (not on the first occurrence)
  - Prefer duplication over wrong abstraction; it's easier to refactor duplication than to fix a bad abstraction
  - When creating abstractions, ensure they're truly generic and not overly tailored to current use cases
- **KISS (Keep It Simple, Stupid):** 
  - Prefer the simplest design that satisfies requirements
  - Avoid premature optimization or over-engineered abstractions
  - Favor explicit code over clever tricks that save few lines but reduce clarity
  - When in doubt, choose the more readable solution

---

## 5. Code Structure & Organization Rules

Maintainable code organization is crucial for team productivity.

- **Small, Single-Purpose Functions:** 
  - Functions should be small (ideally < 30 lines) with one level of abstraction per function (stepdown rule)
  - Break down complex functions into smaller, well-named helper functions
  - Each function should do one thing and do it well
- **Parameter Limit:** 
  - Limit parameters to 0–2. Group 3+ parameters into an options object
  - Use objects with destructuring for clearer function signatures when needed
  - Consider currying or partial application for specialized cases
- **Command / Query Separation (CQS):** 
  - A function either performs an action (command) or returns data (query), never both
  - Commands should return void or a promise (for async operations)
  - Queries should be pure functions without side effects when possible
  - This makes reasoning about code easier and enables better caching strategies
- **Avoid Barrel Files:** 
  - Do not create `index.ts` files that only re-export sibling files
  - Import directly from specific source files (e.g., `import { slash } from './utils/slash'` instead of `./utils`)
  - Barrel files degrade Vite HMR performance and tree-shaking efficiency
- **Vite Path Aliases:** 
  - Consistently use configured path aliases (e.g. `@/components/Button`, `@/lib/utils`) rather than deep relative imports
  - Configure aliases in `tsconfig.json` and `vite.config.ts` for consistency
- **File Organization:** 
  - Group related functionality together (co-location principle)
  - Keep components, styles, and tests for a feature in the same directory when possible
  - Separate concerns: UI components, business logic, data access, and configuration

---

## 6. State Management Rules

Proper state management prevents bugs and improves performance.

- **Keep State Local:** 
  - Prefer component-local state (`useState`) when data is consumed by a single component subtree
  - Only lift state when necessary for sharing between components
  - Use context sparingly and only for truly global state (theme, user auth, etc.)
- **Server State vs Client State:** 
  - Use dedicated query libraries (React Query) for API data fetching and caching
  - Reserve global stores (Zustand) for true client-only session state (UI preferences, modal states, etc.)
  - Never store server data in global state managers; use React Query for that
- **Immutability:** 
  - Never mutate state objects directly; use immutable update patterns
  - Use Immer or similar libraries for complex state updates when needed
  - For simple updates, use object/spread syntax: `{ ...state, field: newValue }`
- **State Serializability:** 
  - Ensure state can be serialized (no functions, promises, or non-serializable values in React state)
  - This enables features like time-travel debugging and persistence

---

## 7. Validation Strategy

Robust validation protects data integrity and system security.

- **Boundary Validation:** 
  - Validate all external inputs (API request bodies, URL params, form submissions, environment variables) at system boundaries using schema validators (Zod)
  - Never trust client-side validation alone; always validate on the server
  - Use Zod for runtime type safety and validation with static TypeScript inference
- **Type Predicates:** 
  - Use TypeScript type predicates (`val is TargetType`) instead of manual type casting (`as TargetType`)
  - This provides better type safety and IDE support
  - Example: `function isValidEmail(email: unknown): email is string { /* validation logic */ }`
- **Validation Libraries:** 
  - Standardize on Zod for schema validation throughout the application
  - Use Zod's `.safeParse()` method for validation that doesn't throw exceptions
  - Create reusable schemas for common validation patterns (email, phone, ID fields, etc.)

---

## 8. Error Handling & Security Practices

Secure, resilient systems require thoughtful error handling and security practices.

- **Exceptions over Error Codes:** 
  - Use `try/catch` and custom Error classes rather than threading error codes through call stacks
  - Create domain-specific error classes (e.g., `ValidationError`, `AuthenticationError`, `NotFoundError`)
  - Handle errors at appropriate levels; don't swallow exceptions unless intentionally logging and continuing
- **Zero-Trust Security:** 
  - Sanitize user input before rendering to prevent XSS (use DOMPurify or similar for HTML content)
  - Use parameterized SQL queries / ORMs (Prisma) to prevent SQL injection
  - Implement proper CORS policies and rate limiting on API endpoints
  - Set security headers (Helmet.js or equivalent)
- **No Secrets in Code & Client Isolation:** 
  - Never hardcode secret keys, API tokens, or credentials in source code
  - In Vite projects, client-exposed variables MUST use the `VITE_` prefix and be validated via schema
  - Server-only secrets MUST NEVER be prefixed with `VITE_`
  - Use environment variables and secrets management (AWS Secrets Manager, etc.) for sensitive data
  - Validate all environment variables at startup with a schema (Zod)
- **Authentication & Authorization:** 
  - Implement proper JWT handling with refresh token rotation
  - Use HTTP-only cookies for tokens where appropriate
  - Implement role-based access control (RBAC) with middleware
  - Regularly audit dependencies for security vulnerabilities

---

## 9. Testing & Verification Conventions

Comprehensive testing ensures reliability and prevents regressions.

- **Test Placement:** 
  - Place unit tests adjacent to source files (e.g. `userService.ts` -> `userService.test.ts`) or in `__tests__/` directories
  - Keep test files close to the implementation they test for easy maintenance
  - Use descriptive test names that describe the behavior being tested
- **Test Intent:** 
  - Write tests for critical business logic and bug fixes
  - Do not mock everything blindly; test public behavior and observable outcomes
  - Aim for meaningful test coverage rather than arbitrary percentage targets
  - Test edge cases and error conditions, not just happy paths
- **Testing Framework:** 
  - Use Vitest for unit testing (compatible with Vite)
  - Use React Testing Library for React component testing
  - Use MSW (Mock Service Worker) for API mocking in tests
  - Use Jest-like expect assertions for readability
- **Test Categories:** 
  - Unit tests: Test individual functions and components in isolation
  - Integration tests: Test interactions between multiple units (services, APIs)
  - End-to-end tests: Test critical user journeys (using Playwright or Cypress)
  - Performance tests: Benchmark key operations for regression detection
- **Continuous Integration:** 
  - Run tests on every pull request and push to main branch
  - Enforce minimum test coverage thresholds for new code
  - Generate and review test coverage reports regularly

---

## 10. Commit & PR Conventions

Clean commit history and PR practices improve collaboration.

- **Commit Messages:** 
  - Follow Conventional Commits format (`feat: add user login`, `fix: handle null token`, `docs: update PRD`)
  - Use lowercase and keep messages concise but descriptive
  - Reference issue numbers when applicable (`fix: resolve login timeout #123`)
  - Separate subject from body with a blank line when needed
  - Body should explain what and why, not how
- **Branch Naming:** 
  - `feature/short-description` for new features
  - `fix/issue-description` for bug fixes
  - `docs/description` for documentation changes
  - `refactor/description` for code refactoring
  - `test/description` for test additions/changes
  - `chore/description` for maintenance tasks
  - Keep branch names short but descriptive
- **Pull Requests:** 
  - Keep PRs small and focused (ideally under 400 lines changed)
  - Write clear PR descriptions explaining what, why, and how
  - Include screenshots for UI changes
  - Link to related issues or design documents
  - Request review from relevant team members
  - Address all review comments before merging
  - Use squash merge for feature branches to keep main history clean
- **Code Review:** 
  - Review for correctness, readability, adherence to standards, and performance
  - Check for proper error handling, validation, and security considerations
  - Look for opportunities to simplify or improve the solution
  - Ensure tests are added or updated for new/changed functionality
  - Verify that documentation is updated when necessary