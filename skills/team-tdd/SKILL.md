---
name: team-tdd
description: Red → green → refactor. No production code without a failing test first. Exceptions need user OK.
allowed-tools: [read_file, write_file, edit_file, bash]
---

# Team TDD

Test-driven development discipline. Never write production code without a failing test first.

## The Three Steps

1. **Red** — Write a test that fails. The test must exist before the feature code.
2. **Green** — Write minimal code to make the test pass.
3. **Refactor** — Clean up the code without changing behavior.

## When to Skip TDD

Exceptions require explicit user approval. Document the reason in the plan log.

## Test Structure

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

## Coverage

- Core logic: 80% minimum
- Edge cases: all input types
- Error paths: handled explicitly
- Happy path: always covered

## Output

```
TDD cycle complete.
- Test: <file>
- Red → Green → Refactor: <steps taken>
- Coverage: <pct>%
```