# Enhanced Stylesheet Capabilities Plan

## Overview
This document outlines planned enhancements for the Stylesheet (formerly Style Rules) functionality in the ABsmartly Browser Extension. These enhancements will provide users with more powerful CSS manipulation capabilities while maintaining the visual editing experience.

## Current State
- ✅ Support for normal, hover, active, and focus pseudo-classes
- ✅ CSS rules injected via `<style>` element in document head
- ✅ Comma-separated selectors already work (e.g., `.btn, .button, .cta`)
- ✅ Styles are applied to the stylesheet regardless of element presence (no DOM dependency)
- ✅ !important flag support for all rules
- ✅ waitForElement option (though less critical for stylesheets)

## Planned Enhancements

### 1. Extended Pseudo-Classes Support
**Priority: High**
- `:visited` - Style visited links differently
- `:disabled` - Target disabled form elements
- `:checked` - Style checked checkboxes/radios
- `:nth-child()` - Target specific child elements
- `:nth-of-type()` - Target specific element types
- `:first-child`, `:last-child` - Target position-based elements
- `:not()` - Negative pseudo-class for exclusions
- `:has()` - Parent selector (modern browsers)
- `:is()`, `:where()` - Selector grouping

**Implementation:**
- Add new tabs in the StyleRulesEditor component
- Group related pseudo-classes (e.g., "Form States", "Position", "Structural")
- Provide visual indicators for browser compatibility

### 2. Pseudo-Elements Support
**Priority: High**
- `::before` - Insert content before element
- `::after` - Insert content after element
- `::placeholder` - Style input placeholders
- `::selection` - Style text selection
- `::first-line` - Target first line of text
- `::first-letter` - Target first letter (drop caps)
- `::marker` - Style list item markers
- `::backdrop` - Style dialog/fullscreen backdrops

**Implementation:**
- Separate section in UI for pseudo-elements
- Include `content` property helper for ::before/::after
- Visual preview of pseudo-element effects

### 3. Media Queries Support
**Priority: High**
- Responsive breakpoints (mobile, tablet, desktop)
- Print styles
- Dark/light mode preferences
- Reduced motion preferences
- Device capabilities (hover, pointer, etc.)

**Implementation:**
```typescript
interface MediaQueryRule {
  query: string; // e.g., "(max-width: 768px)"
  styles: Record<string, string>;
}
```
- Preset breakpoints with custom option
- Visual breakpoint indicators
- Preview at different viewport sizes

### 4. Container Queries Support
**Priority: Medium**
- Container-based responsive design
- Style based on parent container size
- More modular component styling

**Implementation:**
- Similar UI to media queries
- Container identification helper
- Fallback strategies for older browsers

### 5. CSS Variables & Calculations
**Priority: Medium**
- Custom properties (CSS variables)
- `calc()` function support
- `min()`, `max()`, `clamp()` functions
- Variable scoping visualization

**Implementation:**
- Variable definition panel
- Auto-complete for defined variables
- Live calculation preview
- Variable inheritance tree view

### 6. Animation & Transition Support
**Priority: Medium**
- Keyframe animations
- Transition properties
- Animation timeline control
- Easing function builder

**Implementation:**
```typescript
interface AnimationRule {
  name: string;
  keyframes: Record<string, Record<string, string>>;
  duration: string;
  easing: string;
  iteration: number | 'infinite';
}
```
- Visual timeline editor
- Preset animations library
- Performance warnings

### 7. Shadow DOM Compatibility
**Priority: Low**
- Penetrating shadow boundaries
- Custom element styling
- ::part() and ::slotted() selectors

**Implementation:**
- Shadow DOM detection
- Strategy selector (pierce/respect boundaries)
- Web Components awareness

### 8. Advanced Selector Features
**Priority: High**
- **Visual Selector Builder**
  - Drag-and-drop selector construction
  - Point-and-click element selection
  - Selector specificity calculator

- **Selector Validation**
  - Real-time syntax checking
  - Performance warnings for complex selectors
  - Browser compatibility indicators

- **Selector Templates**
  - Common patterns library
  - Custom saved selectors
  - Selector explanation/documentation

- **Multi-Selector Management**
  - Group related selectors
  - Bulk operations
  - Selector inheritance visualization

### 9. Enhanced UI/UX Features
**Priority: High**
- **Live Preview**
  - Real-time style application
  - Before/after comparison
  - Multi-device preview

- **Code Generation**
  - Export to CSS file
  - SCSS/LESS conversion
  - CSS-in-JS format

- **Style Organization**
  - Rule grouping/categorization
  - Style inheritance viewer
  - Cascade debugger

### 10. Performance Optimizations
**Priority: Medium**
- CSS rule deduplication
- Automatic vendor prefixing
- Critical CSS extraction
- Unused rule detection
- Specificity optimization suggestions

## Technical Implementation Notes

### Data Structure Extension
```typescript
interface EnhancedStyleRule {
  selector: string;
  mediaQueries?: MediaQueryRule[];
  containerQueries?: ContainerQueryRule[];
  animations?: AnimationRule[];
  variables?: Record<string, string>;
  pseudoElements?: Record<string, Record<string, string>>;
  // Existing pseudo-classes
  states: {
    normal?: Record<string, string>;
    hover?: Record<string, string>;
    active?: Record<string, string>;
    focus?: Record<string, string>;
    // New pseudo-classes
    visited?: Record<string, string>;
    disabled?: Record<string, string>;
    checked?: Record<string, string>;
    [key: string]: Record<string, string> | undefined;
  };
}
```

### Migration Strategy
1. Maintain backward compatibility with existing styleRules format
2. Progressive enhancement - features can be added incrementally
3. Provide migration tools for existing experiments
4. Clear documentation for new features

### Browser Compatibility
- Use feature detection for modern CSS features
- Provide fallbacks where possible
- Clear indicators in UI for browser support levels
- Polyfills for critical functionality

## Success Metrics
- Reduction in custom JavaScript for styling
- Increased adoption of visual editor over JSON editor
- Decreased time to implement complex styling changes
- Improved experiment performance (less DOM manipulation)

## Timeline Estimate
- Phase 1 (2 weeks): Extended pseudo-classes and pseudo-elements
- Phase 2 (2 weeks): Media queries and advanced selectors
- Phase 3 (3 weeks): Animations, variables, and calculations
- Phase 4 (1 week): Performance optimizations and polish

## Notes
- Current implementation already handles comma-separated selectors effectively
- Styles are applied via stylesheet injection, making them more performant than inline styles
- The visual editor should remain intuitive despite added complexity
- Consider progressive disclosure for advanced features