### 🔄 Project Awareness & Context
- **Always read `PLANNING.md`** at the start of a new conversation to understand the project's architecture, goals, style, and constraints.
- **Check `TASK.md`** before starting a new task. If the task isn't listed, add it with a brief description and today's date.
- **Use consistent naming conventions, file structure, and architecture patterns** as described in `PLANNING.md`.
- **Use npm/yarn scripts** for all development commands (build, test, lint, etc.).

### 🧱 Code Structure & Modularity (React Best Practices)
- **Never create a file longer than 500 lines of code.** If a file approaches this limit, refactor by splitting it into modules or helper files.
- **Standard React project structure:**
  ```
  src/
    components/
      ui/           # Reusable UI components
      layout/       # Layout components (Header, Footer, etc.)
      features/     # Feature-specific components
    pages/          # Page components
    hooks/          # Custom hooks
    utils/          # Utility functions
    types/          # Shared TypeScript types
    lib/            # External library configurations
    styles/         # Global styles and CSS
  ```
- **Component organization:** Keep related code together - component logic, types, and styles in the same file when possible
- **Types:** Define component-specific types in the same file as the component, shared types in `types/`
- **Use environment variables** with proper `.env` files for configuration

### 🧪 Testing & Reliability
- **Always create unit tests for new components and functions** using Jest/Vitest and React Testing Library
- **After updating any logic**, check whether existing tests need to be updated
- **Include accessibility tests** using axe-core for all interactive components
- **Tests should live alongside components** (e.g., `Button.test.tsx` next to `Button.tsx`) or in `__tests__/` folders
- Include at least:
  - 1 test for expected rendering/behavior
  - 1 edge case
  - 1 error/failure case
  - Accessibility validation

### ✅ Task Completion
- **Mark completed tasks in `TASK.md`** immediately after finishing them
- Add new sub-tasks or TODOs discovered during development to `TASK.md` under a "Discovered During Work" section

### 📎 Style & Conventions
- **Use TypeScript** for type safety and better developer experience
- **Follow established linting rules** (ESLint, Prettier) and format code consistently
- **Use proper TypeScript interfaces and types** for all props, state, and function parameters
- **Use Tailwind CSS** for consistent styling and design system compliance
- Write **JSDoc comments for complex functions and components**:
  ```typescript
  /**
   * Brief summary of the component/function.
   *
   * @param param1 - Description of parameter
   * @returns Description of return value
   */
  ```

### 🌍 CRITICAL INTERNATIONALIZATION RULE

#### NO HARDCODED TEXT - TRANSLATION TAGS ONLY

**NEVER write hardcoded text strings in JSX, attributes, or user-facing content. ALL user-facing text MUST use translation tags with fallback values.**

```tsx
// ❌ ABSOLUTELY FORBIDDEN - No hardcoded text
<Button>Save Changes</Button>
<h1>Welcome to our platform</h1>
<img src="/image.jpg" alt="User profile" />
<input placeholder="Enter your email" />
<div aria-label="Close dialog">X</div>
<p>Loading...</p>

// ✅ ALWAYS REQUIRED - Translation tags with fallback
<Button>{t('common:buttons.save', 'Save Changes')}</Button>
<h1>{t('pages:home.welcome', 'Welcome to our platform')}</h1>
<img src="/image.jpg" alt={t('common:accessibility.profile_image', 'User profile')} />
<input placeholder={t('common:placeholders.enter_email', 'Enter your email')} />
<div aria-label={t('common:accessibility.close_dialog', 'Close dialog')}>X</div>
<p>{t('common:messages.loading', 'Loading...')}</p>
```

#### Translation Requirements:
1. **Always use the `t()` function** from `useTranslation` hook
2. **Always provide fallback text** as the second parameter
3. **Use proper namespace prefixes** (`common:`, `pages:`, etc.)
4. **Apply to ALL user-facing text** including:
   - Button labels and text content
   - Headings and paragraphs
   - Form labels and placeholders
   - Error messages and alerts
   - Alt text for images
   - Aria-labels and accessibility text
   - Tooltip text
   - Loading states and empty states
   - Table headers and data labels

#### Translation Key Structure:
```
common:buttons.save          // Common reusable buttons
common:labels.email          // Common form labels
common:messages.loading      // Common status messages
common:accessibility.close   // Common accessibility labels
pages:home.hero.title       // Page-specific content
pages:login.form.email      // Page-specific form content
```

### 🔒 ACCESSIBILITY REQUIREMENTS (CRITICAL - LEGAL COMPLIANCE)

#### WCAG 2.2 Level AA Compliance is MANDATORY

All generated code MUST comply with Web Content Accessibility Guidelines 2.2 Level AA. This is a legal requirement for EU Accessibility Act, ADA Title III, AODA, and other international laws.

#### 1. Semantic HTML (REQUIRED)
- **Always use proper HTML elements** (`<button>`, `<nav>`, `<main>`, `<section>`, etc.)
- **Never use `<div>` or `<span>` for interactive elements**
- **Include proper landmark roles** when semantic elements aren't sufficient

```tsx
// ✅ ALWAYS use semantic HTML
<main role="main" id="main-content">
  <h1>{t('pages:profile.title', 'User Profile')}</h1>
  <nav role="navigation" aria-label={t('common:accessibility.main_navigation', 'Main navigation')}>
    <button type="button">{t('common:buttons.menu', 'Menu')}</button>
  </nav>
</main>

// ❌ NEVER use non-semantic elements for interaction
<div onClick={handleClick}>{t('common:buttons.submit', 'Submit')}</div>
```

#### 2. Accessible Names (REQUIRED)
- **All interactive elements must have accessible names**
- **Use `aria-label` for icon buttons**
- **Associate labels with form controls using `htmlFor` and `id`**

```tsx
// ✅ Icon buttons with accessible names
<Button aria-label={t('common:accessibility.delete_item', 'Delete item')}>
  <Trash2 className="h-4 w-4" />
</Button>

// ✅ Form controls with proper labels
<Label htmlFor="email">{t('common:labels.email', 'Email')}</Label>
<Input id="email" type="email" />

// ❌ NEVER create unlabeled interactive elements
<Button><Trash2 className="h-4 w-4" /></Button>
```

#### 3. Focus Management (REQUIRED)
- **Ensure all interactive elements are keyboard accessible**
- **Provide visible focus indicators** (minimum 2px outline)
- **Manage focus for modals and dynamic content**
- **Implement proper tab order**

```tsx
// ✅ Proper modal focus management
<Dialog onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>{t('common:buttons.open_dialog', 'Open Dialog')}</Button>
  </DialogTrigger>
  <DialogContent 
    role="dialog"
    aria-labelledby="dialog-title"
    aria-describedby="dialog-description"
  >
    {/* Focus is automatically managed by Dialog component */}
  </DialogContent>
</Dialog>
```

#### 4. ARIA Attributes (REQUIRED)
- **Use `role="alert"` for error messages**
- **Use `aria-describedby` for help text**
- **Use `aria-invalid="true"` for form fields with errors**
- **Use `aria-current="page"` for current navigation items**

```tsx
// ✅ Error handling with ARIA
<Input
  id="email"
  aria-invalid={hasError ? "true" : "false"}
  aria-describedby={hasError ? "email-error" : "email-help"}
/>
{hasError && (
  <div id="email-error" role="alert" className="text-destructive">
    {t('common:validation.email_invalid', 'Please enter a valid email')}
  </div>
)}
<div id="email-help" className="text-sm text-muted-foreground">
  {t('common:help.email_format', 'We will use this to contact you')}
</div>
```

#### 5. Keyboard Navigation (REQUIRED)
- **All functionality must work with keyboard only**
- **Handle Escape key for closing modals/dropdowns**
- **Provide skip links for main content**

```tsx
// ✅ Skip link implementation
<a 
  href="#main-content" 
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 bg-white p-2 rounded border"
>
  {t('common:accessibility.skip_to_main', 'Skip to main content')}
</a>
```

#### 6. Form Accessibility (CRITICAL)
```tsx
// ✅ Complete accessible form example
function ContactForm() {
  const { t } = useTranslation(['common', 'pages']);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="name">{t('common:labels.name', 'Name')}</Label>
        <Input 
          id="name"
          required
          aria-required="true"
          aria-invalid={errors.name ? "true" : "false"}
          aria-describedby={errors.name ? "name-error" : "name-help"}
        />
        <div id="name-help" className="text-sm text-muted-foreground">
          {t('common:help.name', 'Enter your full name')}
        </div>
        {errors.name && (
          <div id="name-error" role="alert" className="text-destructive text-sm">
            {errors.name}
          </div>
        )}
      </div>
      
      <Button type="submit">
        {t('common:buttons.submit', 'Submit')}
      </Button>
    </form>
  );
}
```

#### 7. Data Tables (REQUIRED)
```tsx
// ✅ Accessible table structure
<table className="w-full">
  <caption className="sr-only">
    {t('common:accessibility.sessions_table', 'List of upcoming sessions')}
  </caption>
  <thead>
    <tr>
      <th scope="col">{t('common:labels.date', 'Date')}</th>
      <th scope="col">{t('common:labels.time', 'Time')}</th>
      <th scope="col">{t('common:labels.status', 'Status')}</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>March 15, 2024</td>
      <td>10:00 AM</td>
      <td>
        <span className="inline-flex items-center gap-1">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>{t('common:status.confirmed', 'Confirmed')}</span>
        </span>
      </td>
    </tr>
  </tbody>
</table>
```

#### 8. Loading States (REQUIRED)
```tsx
// ✅ Accessible loading indicators
<div role="status" aria-label={t('common:accessibility.loading_content', 'Loading content')}>
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  <span className="sr-only">{t('common:messages.loading', 'Loading...')}</span>
</div>
```

#### 9. Color and Contrast (REQUIRED)
- **Never use color alone to convey information**
- **Maintain 4.5:1 contrast ratio for normal text**
- **Pair color with text or icons**

```tsx
// ✅ Don't rely on color alone
<div className="flex items-center gap-2">
  <AlertCircle className="h-4 w-4 text-red-600" />
  <span className="text-red-600">
    {t('common:messages.error_occurred', 'An error occurred')}
  </span>
</div>
```

#### 10. Motion and Animation (REQUIRED)
```tsx
// ✅ Respect motion preferences
<div className="transition-transform duration-200 motion-reduce:transition-none">
  {/* Animated content */}
</div>
```

#### 11. Calendar/Date Picker Accessibility (CRITICAL)
```tsx
// ✅ Accessible date picker with dual input methods
<div>
  <Label htmlFor="date-input">{t('common:labels.date', 'Select Date')}</Label>
  <Input 
    id="date-input"
    type="date"
    placeholder={t('common:placeholders.date_format', 'YYYY-MM-DD')}
    aria-describedby="date-help"
  />
  <div id="date-help" className="text-sm text-muted-foreground">
    {t('common:help.date_format', 'Enter date in YYYY-MM-DD format or use calendar picker')}
  </div>
  
  {/* Calendar widget with keyboard navigation */}
  <div role="grid" aria-label={t('common:accessibility.calendar_grid', 'Calendar')}>
    {/* Proper grid implementation with arrow key navigation */}
  </div>
</div>
```

#### 12. Mobile Accessibility (REQUIRED)
- **Minimum 24px x 24px touch targets**
- **Support both touch and keyboard navigation**
- **Test zoom up to 200% without horizontal scrolling**

### 🚫 ZERO TOLERANCE ACCESSIBILITY POLICY

- **Any hardcoded text is a critical violation**
- **All code will be rejected if hardcoded text is found**
- **No exceptions** - even for "temporary" or "placeholder" text
- **Any missing accessibility features is a compliance violation**
- **Accessibility is a legal requirement, not optional**

### 🧪 Accessibility Testing (REQUIRED)

#### Every component MUST include accessibility tests:
```typescript
// ✅ Required accessibility test structure
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import MyComponent from './MyComponent';

expect.extend(toHaveNoViolations);

describe('MyComponent Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(<MyComponent />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be keyboard navigable', () => {
    render(<MyComponent />);
    // Test keyboard navigation
  });

  it('should work with screen readers', () => {
    render(<MyComponent />);
    // Test screen reader compatibility
  });
});
```

### 📚 Documentation & Explainability
- **Update `README.md`** when new features are added, dependencies change, or setup steps are modified
- **Comment non-obvious code** and ensure everything is understandable to a mid-level developer
- When writing complex logic, **add an inline `// Reason:` comment** explaining the why, not just the what

### 🧠 AI Behavior Rules
- **Never assume missing context. Ask questions if uncertain**
- **Never hallucinate libraries or functions** – only use known, verified npm packages that exist in package.json
- **Always confirm file paths and component names** exist before referencing them in code or tests
- **Never delete or overwrite existing code** unless explicitly instructed to or if part of a task from `TASK.md`
- **Always follow accessibility guidelines** - this is a legal requirement, not optional
- **Always use translation functions** - no hardcoded text is ever acceptable
- **Always include accessibility tests** for new components
- **Always test keyboard navigation** when creating interactive elements