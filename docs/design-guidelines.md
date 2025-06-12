# Design Guidelines
## Azee - Donut Shop Management System

### 1. Design Philosophy

**Design Principles**:
- **Simplicity**: Clean, intuitive interfaces that reduce cognitive load
- **Consistency**: Uniform design patterns across all pages and components
- **Accessibility**: Inclusive design for users of all abilities
- **Efficiency**: Streamlined workflows that minimize clicks and steps
- **Scalability**: Design system that grows with business needs

**Brand Values**:
- Professional yet approachable
- Modern and clean
- Trustworthy and reliable
- User-centric

### 2. Color Palette

#### 2.1 Primary Colors
```css
/* Primary Brand Colors */
--krispy-green: #046A38     /* Main brand color - success, confirm actions */
--krispy-green-light: #057940  /* Hover states, light backgrounds */
--krispy-green-dark: #035C30   /* Active states, dark elements */

/* Secondary Colors */
--neutral-50: #F9FAFB      /* Light backgrounds */
--neutral-100: #F3F4F6     /* Card backgrounds */
--neutral-200: #E5E7EB     /* Borders, dividers */
--neutral-300: #D1D5DB     /* Disabled states */
--neutral-400: #9CA3AF     /* Placeholder text */
--neutral-500: #6B7280     /* Secondary text */
--neutral-600: #4B5563     /* Primary text */
--neutral-700: #374151     /* Headings */
--neutral-800: #1F2937     /* Dark text */
--neutral-900: #111827     /* Darkest text */
```

#### 2.2 Semantic Colors
```css
/* Status Colors */
--success: #046A38         /* Success messages, completed states */
--warning: #F59E0B         /* Warning messages, pending states */
--error: #EF4444           /* Error messages, destructive actions */
--info: #3B82F6            /* Information messages, links */

/* Background Variants */
--success-bg: #F0F9F5      /* Success background */
--warning-bg: #FFFBEB      /* Warning background */
--error-bg: #FEF2F2        /* Error background */
--info-bg: #EFF6FF         /* Info background */
```

#### 2.3 Usage Guidelines
- **Primary Green**: Use for main CTAs, navigation active states, success indicators
- **Neutral Gray Scale**: Use for text hierarchy, borders, backgrounds
- **Semantic Colors**: Use only for their intended purposes (success, error, warning, info)
- **Contrast**: Ensure minimum 4.5:1 contrast ratio for text on backgrounds

### 3. Typography

#### 3.1 Font Family
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
```

#### 3.2 Type Scale
```css
/* Headings */
--text-4xl: 2.25rem / 2.5rem   /* h1 - Page titles */
--text-3xl: 1.875rem / 2.25rem /* h2 - Section headers */
--text-2xl: 1.5rem / 2rem      /* h3 - Subsection headers */
--text-xl: 1.25rem / 1.75rem   /* h4 - Card titles */
--text-lg: 1.125rem / 1.75rem  /* h5 - Small headings */

/* Body Text */
--text-base: 1rem / 1.5rem     /* Regular body text */
--text-sm: 0.875rem / 1.25rem  /* Small text, labels */
--text-xs: 0.75rem / 1rem      /* Captions, meta text */
```

#### 3.3 Font Weights
```css
--font-light: 300      /* Light emphasis */
--font-normal: 400     /* Regular text */
--font-medium: 500     /* Semi-bold labels */
--font-semibold: 600   /* Headings, important text */
--font-bold: 700       /* Strong emphasis */
```

#### 3.4 Usage Guidelines
- **Page Titles**: text-4xl, font-bold, neutral-900
- **Section Headers**: text-2xl, font-semibold, neutral-800
- **Body Text**: text-base, font-normal, neutral-600
- **Labels**: text-sm, font-medium, neutral-700
- **Meta Information**: text-xs, font-normal, neutral-500

### 4. Layout & Spacing

#### 4.1 Spacing Scale
```css
/* Spacing System (Tailwind-based) */
--space-1: 0.25rem    /* 4px */
--space-2: 0.5rem     /* 8px */
--space-3: 0.75rem    /* 12px */
--space-4: 1rem       /* 16px */
--space-5: 1.25rem    /* 20px */
--space-6: 1.5rem     /* 24px */
--space-8: 2rem       /* 32px */
--space-10: 2.5rem    /* 40px */
--space-12: 3rem      /* 48px */
--space-16: 4rem      /* 64px */
--space-20: 5rem      /* 80px */
```

#### 4.2 Grid System
- **Container Max Width**: 1280px (xl breakpoint)
- **Sidebar Width**: 256px (w-64)
- **Main Content**: Flexible width with proper margins
- **Card Spacing**: 24px gaps between cards

#### 4.3 Breakpoints
```css
/* Responsive Breakpoints */
--sm: 640px      /* Mobile landscape */
--md: 768px      /* Tablet */
--lg: 1024px     /* Desktop */
--xl: 1280px     /* Large desktop */
--2xl: 1536px    /* Extra large */
```

### 5. Components

#### 5.1 Buttons

**Primary Button**:
```css
.btn-primary {
  background: var(--krispy-green);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: var(--krispy-green-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(4, 106, 56, 0.3);
}
```

**Secondary Button**:
```css
.btn-secondary {
  background: var(--neutral-100);
  color: var(--neutral-700);
  border: 1px solid var(--neutral-300);
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
}

.btn-secondary:hover {
  background: var(--neutral-200);
  border-color: var(--neutral-400);
}
```

**Danger Button**:
```css
.btn-danger {
  background: var(--error);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
}

.btn-danger:hover {
  background: #DC2626;
}
```

#### 5.2 Form Elements

**Input Fields**:
```css
.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--neutral-300);
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--krispy-green);
  box-shadow: 0 0 0 3px rgba(4, 106, 56, 0.1);
}
```

**Labels**:
```css
.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--neutral-700);
  margin-bottom: 0.5rem;
}
```

**Select Dropdowns**:
```css
.form-select {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--neutral-300);
  border-radius: 0.5rem;
  background: white;
  cursor: pointer;
}
```

#### 5.3 Cards

**Standard Card**:
```css
.card {
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  border: 1px solid var(--neutral-200);
}

.card-header {
  border-bottom: 1px solid var(--neutral-200);
  padding-bottom: 1rem;
  margin-bottom: 1rem;
}
```

#### 5.4 Navigation

**Navbar**:
```css
.navbar {
  background: white;
  border-bottom: 1px solid var(--neutral-200);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 50;
}

.nav-link {
  color: var(--neutral-600);
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.nav-link:hover,
.nav-link.active {
  background: var(--krispy-green);
  color: white;
}
```

#### 5.5 Tables

**Data Tables**:
```css
.table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.table th {
  background: var(--neutral-50);
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: var(--neutral-700);
  border-bottom: 1px solid var(--neutral-200);
}

.table td {
  padding: 1rem;
  border-bottom: 1px solid var(--neutral-100);
}

.table tr:hover {
  background: var(--neutral-50);
}
```

### 6. Icons & Imagery

#### 6.1 Icon System
- **Library**: Lucide React
- **Size Standards**: 16px (sm), 20px (base), 24px (lg), 32px (xl)
- **Style**: Outline style for consistency
- **Color**: Inherit from parent text color

**Common Icons**:
- Navigation: `Menu`, `X`, `ChevronDown`
- Actions: `Plus`, `Edit`, `Trash2`, `Save`
- Status: `Check`, `AlertTriangle`, `Info`, `X`
- Data: `BarChart3`, `TrendingUp`, `Calendar`

#### 6.2 Usage Guidelines
- Use icons consistently throughout the application
- Always pair icons with text labels for accessibility
- Maintain consistent sizing within component groups
- Use semantic colors for status icons

### 7. States & Interactions

#### 7.1 Loading States
```css
.loading-spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--neutral-200);
  border-top: 2px solid var(--krispy-green);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

#### 7.2 Error States
- Use error color (#EF4444) for error messages
- Include clear error descriptions
- Provide actionable next steps when possible

#### 7.3 Empty States
- Use neutral illustrations or icons
- Include helpful messaging
- Provide clear call-to-action buttons

#### 7.4 Hover Effects
- Subtle elevation for cards and buttons
- Color transitions for interactive elements
- Maintain consistent timing (0.2s transition)

### 8. Accessibility Guidelines

#### 8.1 Color Accessibility
- Maintain minimum 4.5:1 contrast ratio for text
- Don't rely solely on color to convey information
- Provide alternative indicators for colorblind users

#### 8.2 Keyboard Navigation
- Ensure all interactive elements are keyboard accessible
- Provide visible focus indicators
- Implement logical tab order

#### 8.3 Screen Reader Support
- Use semantic HTML elements
- Provide alt text for images
- Include aria-labels for icon buttons
- Use proper heading hierarchy

#### 8.4 Motion & Animation
- Respect user preferences for reduced motion
- Keep animations subtle and purposeful
- Provide alternative feedback for users who disable animations

### 9. Component Patterns

#### 9.1 Dashboard Layout
```
┌─────────────────────────────────────┐
│            Navbar                   │
├─────────────────────────────────────┤
│ Page Title    │                     │
│ Breadcrumb    │     Main Content    │
│               │                     │
│ Stats Cards   │                     │
└─────────────────────────────────────┘
```

#### 9.2 Form Layout
- Group related fields together
- Use consistent spacing between form groups
- Place primary actions on the right
- Include validation feedback inline

#### 9.3 Data Display
- Use tables for structured data
- Include sorting and filtering capabilities
- Provide export options for reports
- Show loading states during data fetching

### 10. Implementation Guidelines

#### 10.1 CSS Architecture
- Use Tailwind CSS utility classes
- Create custom components for reusable patterns
- Maintain consistent class naming conventions
- Document custom CSS components

#### 10.2 Component Structure
```jsx
// Standard component structure
const ComponentName = ({ prop1, prop2 }) => {
  return (
    <div className="component-wrapper">
      <ComponentHeader />
      <ComponentContent />
      <ComponentFooter />
    </div>
  );
};
```

#### 10.3 Responsive Design
- Mobile-first approach
- Use Tailwind responsive prefixes
- Test on multiple screen sizes
- Ensure touch targets are adequate (44px minimum)

### 11. Brand Assets

#### 11.1 Logo Usage
- Maintain clear space around logo
- Use appropriate logo variant for background
- Don't modify logo colors or proportions

#### 11.2 Color Applications
- Primary green for main brand elements
- Neutral grays for UI elements
- Semantic colors only for status indicators

### 12. Documentation & Maintenance

#### 12.1 Style Guide Updates
- Update this document when making design changes
- Maintain version history of design decisions
- Document rationale behind design choices

#### 12.2 Component Library
- Maintain reusable component library
- Document component props and usage
- Include visual examples for each component

### 13. Quality Assurance

#### 13.1 Design Review Checklist
- [ ] Consistent with established patterns
- [ ] Accessible to all users
- [ ] Responsive across devices
- [ ] Proper contrast ratios
- [ ] Semantic HTML structure
- [ ] Loading and error states handled

#### 13.2 Cross-browser Testing
- Test on Chrome, Firefox, Safari, Edge
- Verify functionality on mobile devices
- Check for layout issues on different screen sizes 