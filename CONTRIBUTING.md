# Contributing Guidelines

Welcome to the frontend project! When contributing code, please follow these guidelines, especially regarding how we write comments.

## Inline Comment Specificity

We believe that code should explain **"What"** it does through clear variable and function naming. Inline comments should be reserved for explaining **"Why"** something was done.

### ❌ Bad Practice (Explaining the "What")
Do not write comments that simply translate the code into English.

```javascript
// assign 5 to maxRetries
const maxRetries = 5;

// check if user is active
if (user.isActive) {
  // do something
}
```

### ✅ Good Practice (Explaining the "Why")
Use comments to explain complex logic, workarounds, or magic numbers.

```javascript
// We limit retries to 5 to prevent infinite loops when the backend service goes down under heavy load.
const maxRetries = 5;

// WORKAROUND: The old API v1 returns 'active' as a string instead of boolean. 
// We are forcing type coercion here until the backend v2 is deployed next month.
if (String(user.isActive) === 'true') {
  // do something
}
```

Please keep this in mind during your development and code reviews!
