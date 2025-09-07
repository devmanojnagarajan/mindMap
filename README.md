# 🧠 Coggle Clone - Interactive Mind Mapping Tool

A powerful, collaborative mind mapping application built with vanilla JavaScript, featuring advanced undo/redo functionality, real-time visualization, and intuitive drag-and-drop interactions.

![Mind Map Demo](docs/demo-screenshot.png)

## ✨ Features

### Core Functionality
- 🎯 **Interactive Node Creation** - Click anywhere to create new nodes
- 🔗 **Smart Connection System** - Drag between nodes to create connections
- ✏️ **Inline Text Editing** - Double-click any node to edit text
- 🎨 **Visual Customization** - Multiple node shapes, colors, and styles
- 📸 **Image Support** - Add images to nodes with flexible positioning
- 🔍 **Zoom & Pan** - Smooth navigation across large mind maps

### Advanced Features
- ⏪ **Undo/Redo System** - Comprehensive history management with 50-step memory
- 🎮 **Keyboard Shortcuts** - Efficient workflow with hotkeys
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile
- 🎭 **Control Points** - Fine-tune connection curves with draggable control points
- 📐 **Minimap Navigation** - Bird's eye view for large mind maps
- 🎪 **Multi-Selection** - Select and manipulate multiple nodes at once

### User Experience
- 🖱️ **Intuitive Interactions** - Context menus, hover effects, and visual feedback
- 🎨 **Modern Dark Theme** - Easy on the eyes with a professional look
- ⚡ **Performance Optimized** - Smooth animations and efficient rendering
- 💾 **Auto-Save** - Never lose your work (when backend is connected)

## 🚀 Quick Start

### Prerequisites
- **Node.js** 14.0.0 or higher
- **npm** 6.0.0 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/username/coggle-clone.git
   cd coggle-clone
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   The application will automatically open at `http://localhost:3000`

## 🎮 Usage Guide

### Basic Operations

#### Creating Nodes
- **Click** anywhere on the canvas to create a new node
- **Double-click** a node to edit its text
- **Drag** nodes to reposition them

#### Creating Connections
- **Drag** from the outer ring of any node to another node
- **Drag** to empty space to create a new connected node
- **Click** on connections to select and customize them

#### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo last action |
| `Ctrl+Y` | Redo action |
| `Ctrl+C` | Copy selected nodes |
| `Ctrl+V` | Paste copied nodes |
| `Ctrl+A` | Select all nodes |
| `Delete` | Delete selected nodes/connections |
| `Escape` | Clear selection |
| `Space` | Pan mode (hold and drag) |

### Advanced Features

#### Node Customization
1. Select a node to open the properties panel
2. Customize:
   - **Shape**: Circle, Rectangle, Diamond, Hexagon
   - **Colors**: Background and border colors
   - **Text**: Font size and formatting
   - **Images**: Upload and position images

#### Connection Control Points
1. **Select** any connection line
2. **Control points** appear automatically
3. **Drag** control points to reshape the curve
4. **Right-click** for additional options

#### Undo/Redo System
- Automatically tracks all changes
- **50-step history** for comprehensive editing
- Smart batching of related operations
- Visual feedback for available actions

## 📁 Project Structure

```
coggle-clone/
├── src/                          # Source code
│   ├── js/                       # JavaScript modules
│   │   ├── core/                 # Core functionality
│   │   │   ├── config-manager.js # Configuration management
│   │   │   ├── event-emitter.js  # Event system
│   │   │   ├── error-handler.js  # Error handling
│   │   │   ├── history-manager.js# Undo/redo system
│   │   │   ├── base-manager.js   # Base class for managers
│   │   │   └── utils.js          # Utility functions
│   │   ├── managers/             # Feature managers
│   │   │   ├── node-manager.js   # Node operations
│   │   │   ├── connection-manager.js # Connection handling
│   │   │   └── panel-manager.js  # UI panel management
│   │   ├── app.js               # Main application class
│   │   ├── auth.js              # Authentication (optional)
│   │   ├── mindmap.js           # Legacy mindmap utilities
│   │   └── server.js            # Backend server (optional)
│   └── css/
│       └── styles.css           # Main stylesheet
├── docs/                        # Documentation
├── backend/                     # Optional backend server
├── index.html                   # Main HTML file
├── package.json                 # Node.js configuration
└── README.md                    # This file
```

## 🔧 Development

### Available Scripts

```bash
# Development server with auto-reload
npm run dev

# Production server
npm run start

# Serve for production on port 8080
npm run serve:prod

# Clean temporary files
npm run clean
```

### Architecture Overview

The application follows a **modular architecture** with clear separation of concerns:

#### Core Modules
- **ConfigManager**: Centralized configuration management
- **EventEmitter**: Custom event system for component communication
- **HistoryManager**: Comprehensive undo/redo functionality
- **ErrorHandler**: Robust error handling and user feedback

#### Manager Classes
- **NodeManager**: Handles all node-related operations (create, edit, delete, drag)
- **ConnectionManager**: Manages connections and control points
- **PanelManager**: Controls UI panels and property editing

#### Main Application
- **MindMap Class**: Central coordinator that orchestrates all managers
- **Event-driven Architecture**: Loose coupling between components
- **State Management**: Centralized state with history tracking

### Key Design Patterns

1. **Manager Pattern**: Feature-specific managers for modular code
2. **Observer Pattern**: Event-driven communication between components
3. **Command Pattern**: Undo/redo implementation with command objects
4. **Factory Pattern**: Node and connection creation
5. **Strategy Pattern**: Different rendering strategies for shapes

## 🎨 Customization

### Themes and Colors
Edit `src/css/styles.css` to customize the visual theme:

```css
:root {
    --primary-bg: #111827;
    --secondary-bg: #1F2937;
    --accent-color: #38BDF8;
    --primary-text: #F9FAFB;
    /* ... more variables */
}
```

### Adding New Node Shapes
1. Add shape definition in `NodeManager.createNodeShape()`
2. Update the shape selector in `PanelManager`
3. Add corresponding CSS styles

### Extending Functionality
- **Custom Tools**: Add new tools to the toolbar
- **Export Formats**: Implement additional export options
- **Collaboration**: Extend with real-time collaboration features

## 🔌 API Integration

### Backend Integration (Optional)
The application can work with a backend server for:
- **Persistent Storage**: Save/load mind maps
- **User Authentication**: Multi-user support
- **Real-time Collaboration**: Live editing with others

Example backend endpoints:
```javascript
// Save mind map
POST /api/mindmaps
{
  "nodes": [...],
  "connections": [...],
  "metadata": {...}
}

// Load mind map
GET /api/mindmaps/:id

// Real-time updates
WebSocket /api/mindmaps/:id/live
```

## 🚀 Deployment

### Static Hosting
Deploy to any static hosting service:

1. **Netlify**
   ```bash
   # Build command: npm run build
   # Publish directory: .
   ```

2. **Vercel**
   ```bash
   # No build step required
   # Root directory: .
   ```

3. **GitHub Pages**
   ```bash
   # Enable GitHub Pages in repository settings
   # Source: main branch
   ```

### Docker Deployment
```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 🧪 Testing

### Manual Testing Checklist
- [ ] Node creation and editing
- [ ] Connection creation and manipulation
- [ ] Undo/redo operations
- [ ] Keyboard shortcuts
- [ ] Multi-selection operations
- [ ] Panel interactions
- [ ] Zoom and pan functionality
- [ ] Mobile responsiveness

### Automated Testing (Future)
```bash
# Unit tests (when implemented)
npm test

# E2E tests (when implemented)
npm run test:e2e
```

## 🐛 Troubleshooting

### Common Issues

**Issue**: Nodes not creating when clicking
- **Solution**: Check browser console for JavaScript errors
- **Check**: Ensure all script files are loaded correctly

**Issue**: Undo/redo not working
- **Solution**: Verify HistoryManager is initialized
- **Check**: Look for "History Manager initialized" in console

**Issue**: Styling not applied
- **Solution**: Clear browser cache and reload
- **Check**: Verify CSS file path in index.html

**Issue**: Performance issues with large maps
- **Solution**: Use minimap for navigation
- **Tip**: Consider breaking large maps into smaller sections

### Debug Mode
Enable debug mode by adding `?debug=true` to the URL:
```
http://localhost:3000/?debug=true
```

This enables:
- Console logging for all operations
- Performance timing information
- State inspection tools

## 📚 Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome  | 80+     | ✅ Full Support |
| Firefox | 75+     | ✅ Full Support |
| Safari  | 13+     | ✅ Full Support |
| Edge    | 80+     | ✅ Full Support |
| Opera   | 70+     | ✅ Full Support |

### Required Features
- ES6 Modules
- SVG manipulation
- CSS Grid/Flexbox
- Modern DOM APIs
- LocalStorage (optional)

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Add JSDoc comments for new functions
- Test thoroughly before submitting
- Update documentation for new features

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🏆 Acknowledgments

- **Coggle.it** - Inspiration for the mind mapping interface
- **D3.js** - Concepts for SVG manipulation
- **RemixIcon** - Beautiful iconography
- **Poppins Font** - Typography choice

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/username/coggle-clone/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/username/coggle-clone/discussions)
- 📧 **Contact**: developer@example.com

---

**Made with ❤️ using Vanilla JavaScript**