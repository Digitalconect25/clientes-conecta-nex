```markdown
# clientes-conecta-nex Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `clientes-conecta-nex` JavaScript codebase. It covers file naming, import/export styles, commit patterns, and testing conventions. While no specific frameworks or automated workflows were detected, this guide provides clear instructions and code examples to help you contribute effectively.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `userProfile.js`, `orderManager.test.js`

### Import Style
- Use **relative imports** for modules within the project.
  - Example:
    ```javascript
    import userService from './userService';
    import { getOrder } from '../orders/orderUtils';
    ```

### Export Style
- Both **default** and **named exports** are used.
  - Default export example:
    ```javascript
    export default function processClient(data) { ... }
    ```
  - Named export example:
    ```javascript
    export function validateClient(client) { ... }
    export const CLIENT_TYPE = 'premium';
    ```

### Commit Patterns
- Commit messages are **freeform** (no strict prefixes).
- Average commit message length: ~169 characters.
- Example:
  ```
  Fixed issue with client data validation and improved error handling in the registration process
  ```

## Workflows

_No automated workflows detected in this repository. Below are suggested manual workflows for common development tasks._

### Running Tests
**Trigger:** When you want to verify code changes.
**Command:** `/run-tests`

1. Identify test files (pattern: `*.test.*`).
2. Run tests using your preferred JavaScript test runner (e.g., Jest, Mocha).
   ```bash
   npx jest
   ```
   or
   ```bash
   npx mocha
   ```
3. Review test output for failures.

### Adding a New Feature
**Trigger:** When implementing new functionality.
**Command:** `/add-feature`

1. Create a new file using camelCase naming.
2. Write your module using relative imports/exports.
3. Add or update corresponding test files (`*.test.js`).
4. Commit changes with a descriptive message.
5. Run tests to ensure correctness.

### Refactoring Code
**Trigger:** When improving or restructuring existing code.
**Command:** `/refactor`

1. Update file and variable names to follow camelCase.
2. Ensure all imports are relative and up-to-date.
3. Adjust exports as needed (default or named).
4. Update or add tests if necessary.
5. Commit with a clear message explaining the refactor.

## Testing Patterns

- **Test files** follow the pattern: `*.test.*` (e.g., `userService.test.js`).
- **Testing framework** is not specified; use your preferred runner (e.g., Jest, Mocha).
- Example test file:
  ```javascript
  import { validateClient } from './clientUtils';

  test('should validate premium client', () => {
    const client = { type: 'premium', active: true };
    expect(validateClient(client)).toBe(true);
  });
  ```

## Commands
| Command       | Purpose                                   |
|---------------|-------------------------------------------|
| /run-tests    | Run all test files in the repository      |
| /add-feature  | Steps to add a new feature/module         |
| /refactor     | Steps to refactor code and update tests   |
```