---
name: testing
description: Write and run tests, fix failures. Follow TDD: red → green → refactor.
allowed-tools: [read_file, write_file, edit_file, bash]
---

# Testing

Write tests for code you write. Follow red → green → refactor, never shipping production code without a failing test first (unless user OK).

## Red → Green → Refactor

1. **Red**: Write a test that fails. The test must exist before production code.
2. **Green**: Write minimal production code to make the test pass. Keep it simple.
3. **Refactor**: Clean up production code (rename, extract, structure) without changing behavior. All tests must still pass.

## Test Structure (example)

```js
describe('Feature', () => {
  test('does X when given Y', () => {
    // arrange
    const input = 'Y';
    // act
    const result = feature(input);
    // assert
    expect(result).toBe('expected');
  });
});
```

## Coverage Requirements

Minimum acceptable coverage:
- Core logic: 80% (all functions covered)
- Edge cases: all input types handled
- Error paths: all exceptions explicitly tested
- Happy path: always covered

## Test Organization

- Put tests in `.test.js` files if that's the convention.
- Use one describe block per feature.
- Each test should be independent (no shared state).

## When to Skip TDD

Exceptions require explicit user approval. Document the reason in the plan log.

## Output

After each TDD cycle:
```
TDD cycle complete.
- Test file: <filename>
- Red → Green → Refactor: <summary of steps>
- Coverage: <X>% (minimal acceptable 80%)
```

---
**Note:** If tests fail, fix production code. Never edit tests unless they are incomplete or wrong.
