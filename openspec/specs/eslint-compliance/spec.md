# ESLint Compliance Specification

## Purpose

Achieve zero `no-explicit-any` violations across 12 files by replacing `any` with typed interfaces, type guards, or inferred types. The codebase SHALL pass `eslint .` with zero errors and zero warnings.

## Requirements

### Requirement: No Explicit `any` in TypeScript Code

All TypeScript modules SHALL use explicit types, type inference, or `unknown` with narrowing instead of `any`. The `any` type MUST NOT appear in function parameters, return types, or variable declarations.

#### Scenario: Function parameter is typed instead of `any`

- GIVEN a function signature uses `(data: any)` in any of the 12 affected files
- WHEN the type is replaced with a specific interface, union type, or generic
- THEN `eslint` reports zero `no-explicit-any` errors
- AND `tsc --noEmit` still passes without new errors

#### Scenario: API response is narrowed from `unknown` instead of cast as `any`

- GIVEN a Supabase query result is typed as `any` for data extraction
- WHEN the code uses `unknown` with a type guard or assertion function
- THEN the narrowed type is used throughout the call chain
- AND no type assertion bypasses type safety

#### Scenario: CI pipeline enforces the rule

- GIVEN `eslint .` runs in CI or pre-commit hooks
- WHEN all 25 `no-explicit-any` occurrences have been resolved
- THEN the command exits with code 0
- AND new `any` usages are blocked by the linter configuration
