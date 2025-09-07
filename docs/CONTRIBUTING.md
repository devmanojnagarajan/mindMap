# Contributing to Coggle Clone

Thank you for considering contributing to the Coggle Clone project! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 14.0.0 or higher
- npm 6.0.0 or higher  
- Git
- A code editor (VS Code recommended)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/coggle-clone.git
   cd coggle-clone
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📝 Code Guidelines

### JavaScript Style Guide

- Use **ES6+** features where appropriate
- Follow **camelCase** naming convention
- Use **const/let** instead of var
- Add **JSDoc comments** for all public methods
- Keep functions small and focused
- Use meaningful variable names

```javascript
/**
 * Creates a new node with the specified parameters
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate  
 * @param {string} text - Node text content
 * @param {Object} options - Additional options
 * @returns {Object} The created node object
 */
createNode(x, y, text, options = {}) {
    // Implementation
}
```

### CSS Guidelines

- Use **CSS custom properties** for theming
- Follow **BEM methodology** for class names
- Maintain **responsive design** principles
- Use **meaningful class names**
- Group related styles together

```css
/* Component */
.node-manager {
    /* styles */
}

/* Element */
.node-manager__item {
    /* styles */
}

/* Modifier */
.node-manager__item--selected {
    /* styles */
}
```

### HTML Guidelines

- Use **semantic HTML5** elements
- Include **accessibility attributes**
- Follow **proper nesting** structure
- Add **meaningful IDs and classes**

## 🏗️ Architecture Guidelines

### File Organization

```
src/js/
├── core/           # Core functionality that other modules depend on
├── managers/       # Feature-specific managers  
├── utils/          # Utility functions and helpers
└── app.js         # Main application entry point
```

### Manager Pattern

Each feature should have its own manager class:

```javascript
class FeatureManager {
    constructor(mindMap) {
        this.mindMap = mindMap;
        this.init();
    }
    
    init() {
        // Initialize the manager
    }
    
    // Public methods
}
```

### Event System

Use the EventEmitter for component communication:

```javascript
// Emit event
this.mindMap.eventEmitter.emit('nodeCreated', { node });

// Listen for event  
this.mindMap.eventEmitter.on('nodeCreated', (data) => {
    // Handle event
});
```

## 🧪 Testing

### Manual Testing

Before submitting a PR, test:
- [ ] Basic node operations (create, edit, delete)
- [ ] Connection creation and manipulation
- [ ] Undo/redo functionality
- [ ] Keyboard shortcuts
- [ ] Mobile responsiveness
- [ ] Cross-browser compatibility

### Test Checklist Template

```markdown
## Test Results

### Environment
- Browser: 
- Version:
- OS:

### Features Tested
- [ ] Node creation
- [ ] Node editing
- [ ] Connection creation
- [ ] Undo/Redo
- [ ] Keyboard shortcuts
- [ ] Mobile view

### Issues Found
- None / List any issues
```

## 🎯 Types of Contributions

### 🐛 Bug Fixes
- Check existing issues before creating new ones
- Provide clear reproduction steps
- Include browser/environment details
- Test the fix thoroughly

### ✨ New Features
- Discuss in issues before implementing
- Follow the existing architecture patterns
- Add documentation
- Consider performance implications

### 📚 Documentation
- Improve existing documentation
- Add examples and use cases
- Fix typos and grammar
- Add translations

### 🎨 UI/UX Improvements
- Maintain the existing design language
- Consider accessibility
- Test on multiple devices
- Provide before/after screenshots

## 📋 Pull Request Process

### Before Submitting

1. **Code Quality**
   - [ ] Code follows style guidelines
   - [ ] No console errors
   - [ ] Functions are documented
   - [ ] Code is well-commented

2. **Testing**
   - [ ] Manual testing completed
   - [ ] Cross-browser testing done
   - [ ] Mobile testing completed
   - [ ] No regressions introduced

3. **Documentation**
   - [ ] README updated if needed
   - [ ] Code comments added
   - [ ] JSDoc comments added

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Manual testing completed
- [ ] Cross-browser tested
- [ ] Mobile tested

## Screenshots (if applicable)
Before/after screenshots

## Additional Notes
Any additional information
```

## 🎨 Design Guidelines

### Visual Consistency
- Follow the existing dark theme
- Use consistent spacing (8px grid)
- Maintain visual hierarchy
- Use the defined color palette

### Accessibility
- Ensure proper contrast ratios
- Add ARIA labels where needed
- Support keyboard navigation
- Test with screen readers

### Performance
- Optimize for 60fps animations
- Minimize DOM manipulations
- Use efficient algorithms
- Consider memory usage

## 🔧 Development Tools

### Recommended VS Code Extensions
- ESLint
- Prettier
- Live Server
- JavaScript (ES6) code snippets
- Auto Rename Tag

### Browser Dev Tools
- Use Chrome DevTools for debugging
- Test performance with Lighthouse
- Check accessibility with axe extension

## 📖 Learning Resources

### JavaScript/Web APIs
- [MDN Web Docs](https://developer.mozilla.org/)
- [JavaScript.info](https://javascript.info/)
- [Web APIs](https://developer.mozilla.org/en-US/docs/Web/API)

### SVG Development
- [SVG Tutorial](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial)
- [SVG Reference](https://developer.mozilla.org/en-US/docs/Web/SVG)

## 🏷️ Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `performance` - Performance related
- `accessibility` - Accessibility improvements

## ❓ Getting Help

- **GitHub Discussions**: General questions and ideas
- **GitHub Issues**: Bug reports and feature requests
- **Code Review**: Request review from maintainers

## 🙏 Recognition

Contributors will be:
- Added to the contributors list
- Mentioned in release notes
- Given credit in documentation

Thank you for contributing to make Coggle Clone better! 🎉