# Superbae Support System - Documentation

> **NOTE (frontend removed):** The web frontend has been removed from this
> project — it is now an **API + AI backend only**. Sections below that
> reference `frontend/`, `web/`, Next.js, or UI screens are historical and no
> longer apply. The canonical pieces are `server/` (Express API) and
> `ai-layer/` (FastAPI RAG). See `00_CANONICAL_STACK.md`.


## 📚 Documentation Overview

This directory contains comprehensive documentation for the **Superbae Support System** project.

---

## 🗂️ Documentation Structure

```
docs/
├── README.md                    # This file - Documentation index
│
├── api/                         # API Documentation
│   ├── assistant.md             # AI Assistant API endpoints
│   ├── accounts.md              # User Accounts API
│   ├── kb.md                   # Knowledge Base API
│   └── tickets.md               # Ticketing System API
│
├── architecture/                # System Architecture
│   ├── OVERVIEW.md             # High-level architecture
│   ├── assistant.md             # AI Assistant architecture
│   ├── frontend.md              # Frontend architecture
│   ├── backend.md               # Backend architecture
│   └── server.md                # Node.js server architecture
│
├── database/                    # Database Design
│   ├── schema.md                # Complete database schema
│   ├── assistant.md             # Assistant-related models
│   ├── kb.md                   # Knowledge Base models
│   └── tickets.md               # Ticketing models
│
├── deployment/                  # Deployment Guides
│   ├── README.md                # Deployment overview
│   ├── docker.md                # Docker deployment
│   └── production.md            # Production setup
│
└── user-flows/                  # User Experience
    ├── assistant.md             # AI Assistant user flows
    ├── kb.md                   # Knowledge Base flows
    └── tickets.md               # Ticketing flows
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (for frontend and server)
- MongoDB (local installation, MongoDB Atlas, or Docker)
- Docker & Docker Compose (optional)

### Development Setup

#### Full Stack (Next.js + Node.js)
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (in another terminal)
cd ../frontend
npm install
npm run dev
```

#### Docker (Recommended)
```bash
# At project root
docker-compose up -d
```

---

## 🎯 Core Features

| Feature | Description | Status |
|---------|-------------|--------|
| **AI Assistant** | Intelligent chatbot for user support | ✅ Active |
| **Knowledge Base** | Searchable help articles | ✅ Active |
| **Ticketing System** | Support ticket management | ✅ Active |
| **User Management** | Role-based access control | ✅ Active |
| **Admin Dashboard** | Comprehensive admin interface | ✅ Active |

---

## 📖 Documentation by Feature

### 1. AI Assistant

The AI Assistant provides intelligent support through:

- **Natural Language Understanding**: Comprehend user queries
- **Custom Q&A**: Predefined answers for common questions
- **Knowledge Base Integration**: Search and retrieve help articles
- **Conversation History**: Track user interactions
- **Context Awareness**: Maintain conversation context

**Key Files:**
- Frontend: `frontend/src/components/assistant/AssistantWidget.tsx`
- Admin: `frontend/src/app/admin/assistant/`
- Backend: `backend/src/modules/assistant/`

**Documentation:**
- [API Reference](./api/assistant.md)
- [Architecture](./architecture/assistant.md)
- [User Flows](./user-flows/assistant.md)
- [Database Schema](./database/assistant.md)

### 2. Knowledge Base

Structured help content management:

- **Articles**: Rich text help documents
- **Categories**: Organize articles hierarchically
- **Search**: Full-text search capability
- **Feedback**: User ratings and comments
- **Versioning**: Track article revisions

**Key Files:**
- Frontend: `frontend/src/app/help/`
- Admin: `frontend/src/app/admin/kb/`
- Backend: `backend/src/modules/kb/`

**Documentation:**
- [API Reference](./api/kb.md)
- [User Flows](./user-flows/kb.md)

### 3. Ticketing System

Complete support ticket lifecycle:

- **Creation**: Users submit support requests
- **Assignment**: Auto/manual agent assignment
- **Prioritization**: SLA-based priority levels
- **Resolution**: Agent responses and status updates
- **Escalation**: Automatic escalation rules

**Key Files:**
- User: `frontend/src/app/tickets/`
- Admin: `frontend/src/app/admin/tickets/`
- Components: `frontend/src/components/tickets/`
- Backend: `backend/src/modules/tickets/`

**Documentation:**
- [API Reference](./api/tickets.md)
- [User Flows](./user-flows/tickets.md)
- [Database Schema](./database/tickets.md)

### 4. User Management

Role-based access control:

- **Authentication**: Secure login/registration
- **Roles**: Admin, Agent, User
- **Permissions**: Granular access control
- **Teams**: Group agents by specialty

**Key Files:**
- Frontend: `frontend/src/app/admin/users/`
- Backend: `backend/src/modules/users/`

**Documentation:**
- [API Reference](./api/accounts.md)

---

## 🔧 Technical Stack

### Frontend
- **Framework**: Next.js 15 with React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS and shadcn/ui
- **State**: React hooks and shared client providers

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB
- **ODM**: Mongoose
- **Auth**: JWT-based authentication

### Infrastructure
- **Containerization**: Docker
- **Reverse Proxy**: Nginx
- **CI/CD**: GitHub Actions

---

## 📋 Code Structure Conventions

### File Organization
```
frontend/src/
├── components/      # Reusable UI components
├── pages/          # Page-level components (routes)
├── services/       # API service layers
├── hooks/          # Custom React hooks
├── utils/          # Utility functions
├── types/          # TypeScript type definitions
├── constants/      # Shared constants
└── content/        # Static content data
```

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `AssistantWidget.tsx` |
| Pages | PascalCase | `AssistantAdmin.tsx` |
| Utilities | camelCase | `markdown.ts` |
| Constants | UPPER_SNAKE | `theme.ts` (exports) |
| Types | PascalCase | `AssistantConversation` |

### Code Style
- **Indentation**: 2 spaces (TypeScript), 4 spaces (Python)
- **Quotes**: Double quotes for JSX, single for strings
- **Semicolons**: Required in TypeScript
- **Imports**: Grouped by source (external, internal, relative)

---

## 🐛 Troubleshooting

### Common Issues

#### Frontend not connecting to backend
```bash
# Check if backend is running
curl http://localhost:8001/api/health

# Check API_PROXY_TARGET in frontend/.env.local if using another backend
```

#### Database connection errors
```bash
# Check MONGODB_URI in backend/.env
# MongoDB must be running on port 27017 for local development
```

#### Module not found errors
```bash
# Install missing dependencies
npm install
```

---

## 📞 Support & Contribution

### Getting Help
1. Check this documentation
2. Review the [API Reference](./api/)
3. Examine existing code patterns
4. Check GitHub workflows for CI/CD issues

### Contributing
1. Fork the repository
2. Create a feature branch
3. Follow existing code patterns
4. Add tests for new functionality
5. Update relevant documentation
6. Submit a pull request

---

## 📄 Changelog

| Date | Version | Description |
|------|---------|-------------|
| 2026-08-28 | 1.0.0 | Initial documentation setup |

---

## 🎓 Learning Resources

### React & TypeScript
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Vite Documentation](https://vitejs.dev)

### Django
- [Django Documentation](https://docs.djangoproject.com)
- [Django REST Framework](https://www.django-rest-framework.org)

### Node.js & Express
- [Node.js Documentation](https://nodejs.org/en/docs/)
- [Express.js Guide](https://expressjs.com/en/starter/installing.html)
- [Mongoose Documentation](https://mongoosejs.com/docs/guide.html)

---

*Last updated: 2026-08-28*
*Maintained by: Superbae Development Team*
