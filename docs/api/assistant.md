# AI Assistant API Reference

## 📡 Overview

The AI Assistant API provides endpoints for managing the AI-powered support assistant, including configuration, custom Q&A pairs, and conversation history.

**Base URL**: `/api/assistant/`

---

## 🔧 Authentication

All assistant API endpoints require authentication and admin privileges.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Permissions:**
- Admin users can access all endpoints
- Regular users can only access conversation endpoints for their own sessions

---

## 📋 Data Models

### AssistantConfig

Configuration settings for the AI assistant.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | integer | - | - | Primary key |
| `enabled` | boolean | ✅ | `true` | Whether assistant is active |
| `name` | string | ✅ | `"Assistant"` | Display name for assistant |
| `greeting` | string | ✅ | `"How can I help?"` | Welcome message |
| `suggested_questions` | string[] | - | `[]` | Quick-reply suggestions |
| `created_at` | datetime | - | auto | Creation timestamp |
| `updated_at` | datetime | - | auto | Last update timestamp |

**Example:**
```json
{
  "id": 1,
  "enabled": true,
  "name": "Superbae Assistant",
  "greeting": "Hello! How can I help you today?",
  "suggested_questions": [
    "How do I reset my password?",
    "What are your support hours?",
    "How do I contact an agent?"
  ]
}
```

### AssistantQA

Custom question and answer pairs for the assistant.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | integer | - | - | Primary key |
| `question` | string | ✅ | - | User question pattern |
| `answer` | string | ✅ | - | Assistant response |
| `keywords` | string | - | `""` | Comma-separated match keywords |
| `order` | integer | - | `0` | Priority order (lower = higher priority) |
| `active` | boolean | - | `true` | Whether Q&A is active |
| `created_at` | datetime | - | auto | Creation timestamp |
| `updated_at` | datetime | - | auto | Last update timestamp |

**Example:**
```json
{
  "id": 1,
  "question": "How do I reset my password?",
  "answer": "You can reset your password by clicking 'Forgot Password' on the login page. We'll send you a reset link via email.",
  "keywords": "reset, password, forgot, login",
  "order": 1,
  "active": true
}
```

### AssistantConversation

User conversation session with the assistant.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | integer | - | Primary key |
| `user` | string | ✅ | User identifier (username or email) |
| `user_id` | integer | - | Foreign key to User |
| `started_at` | datetime | ✅ | Conversation start time |
| `last_at` | datetime | ✅ | Last message timestamp |
| `message_count` | integer | - | Number of messages |
| `preview` | string | - | First message preview |
| `messages` | Message[] | - | List of conversation messages |

### Message

Individual message in a conversation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | integer | - | Primary key |
| `role` | string | ✅ | `"user"` or `"assistant"` |
| `text` | string | ✅ | Message content |
| `source` | string | - | Source of answer (e.g., "KB Article", "Custom Q&A") |
| `created_at` | datetime | ✅ | Message timestamp |

**Example Conversation:**
```json
{
  "id": 1,
  "user": "john.doe@email.com",
  "user_id": 1,
  "started_at": "2026-08-28T10:00:00Z",
  "last_at": "2026-08-28T10:05:00Z",
  "message_count": 4,
  "preview": "How do I reset my password?",
  "messages": [
    {
      "id": 1,
      "role": "user",
      "text": "How do I reset my password?",
      "source": null,
      "created_at": "2026-08-28T10:00:00Z"
    },
    {
      "id": 2,
      "role": "assistant",
      "text": "You can reset your password by clicking 'Forgot Password' on the login page.",
      "source": "Custom Q&A",
      "created_at": "2026-08-28T10:00:15Z"
    }
  ]
}
```

---

## 🎯 Endpoints

### Configuration

#### GET /api/assistant/config/

Get the current assistant configuration.

**Request:**
```
GET /api/assistant/config/
```

**Response (200 OK):**
```json
{
  "id": 1,
  "enabled": true,
  "name": "Superbae Assistant",
  "greeting": "Hello! How can I help you today?",
  "suggested_questions": ["How do I reset my password?"]
}
```

**Response (403 Forbidden):**
```json
{
  "error": "Permission denied"
}
```

---

#### PUT /api/assistant/config/

Update the assistant configuration.

**Request:**
```
PUT /api/assistant/config/
Content-Type: application/json

{
  "enabled": true,
  "name": "Updated Assistant",
  "greeting": "Welcome! Ask me anything.",
  "suggested_questions": ["Help", "Support"]
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "enabled": true,
  "name": "Updated Assistant",
  "greeting": "Welcome! Ask me anything.",
  "suggested_questions": ["Help", "Support"]
}
```

---

### Custom Q&A

#### GET /api/assistant/qa/

List all custom Q&A pairs.

**Request:**
```
GET /api/assistant/qa/
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `active` | boolean | Filter by active status |
| `limit` | integer | Maximum results (default: 100) |
| `offset` | integer | Pagination offset |
| `search` | string | Search in questions/answers |

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "question": "How do I reset my password?",
    "answer": "Click 'Forgot Password' on login page...",
    "keywords": "reset, password",
    "order": 1,
    "active": true
  },
  {
    "id": 2,
    "question": "What are your hours?",
    "answer": "We're available 24/7!",
    "keywords": "hours, support, available",
    "order": 2,
    "active": true
  }
]
```

---

#### GET /api/assistant/qa/{id}/

Get a specific Q&A pair.

**Request:**
```
GET /api/assistant/qa/1/
```

**Response (200 OK):**
```json
{
  "id": 1,
  "question": "How do I reset my password?",
  "answer": "Click 'Forgot Password' on login page...",
  "keywords": "reset, password",
  "order": 1,
  "active": true
}
```

**Response (404 Not Found):**
```json
{
  "error": "Q&A not found"
}
```

---

#### POST /api/assistant/qa/

Create a new Q&A pair.

**Request:**
```
POST /api/assistant/qa/
Content-Type: application/json

{
  "question": "How do I contact support?",
  "answer": "You can reach us via email or phone.",
  "keywords": "contact, support, email, phone",
  "order": 3,
  "active": true
}
```

**Response (201 Created):**
```json
{
  "id": 3,
  "question": "How do I contact support?",
  "answer": "You can reach us via email or phone.",
  "keywords": "contact, support, email, phone",
  "order": 3,
  "active": true
}
```

---

#### PUT /api/assistant/qa/{id}/

Update an existing Q&A pair.

**Request:**
```
PUT /api/assistant/qa/1/
Content-Type: application/json

{
  "question": "Updated question",
  "answer": "Updated answer",
  "keywords": "updated, keywords",
  "order": 1,
  "active": true
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "question": "Updated question",
  "answer": "Updated answer",
  "keywords": "updated, keywords",
  "order": 1,
  "active": true
}
```

---

#### DELETE /api/assistant/qa/{id}/

Delete a Q&A pair.

**Request:**
```
DELETE /api/assistant/qa/1/
```

**Response (204 No Content):**
```
(empty body)
```

---

### Conversations

#### GET /api/assistant/conversations/

List all conversations (admin only).

**Request:**
```
GET /api/assistant/conversations/
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | integer | Filter by user ID |
| `limit` | integer | Maximum results (default: 50) |
| `offset` | integer | Pagination offset |
| `date_from` | datetime | Filter by start date |
| `date_to` | datetime | Filter by end date |

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "user": "john.doe@email.com",
    "user_id": 1,
    "started_at": "2026-08-28T10:00:00Z",
    "last_at": "2026-08-28T10:05:00Z",
    "message_count": 4,
    "preview": "How do I reset my password?"
  }
]
```

---

#### GET /api/assistant/conversations/{id}/

Get a specific conversation with full message history.

**Request:**
```
GET /api/assistant/conversations/1/
```

**Response (200 OK):**
```json
{
  "id": 1,
  "user": "john.doe@email.com",
  "user_id": 1,
  "started_at": "2026-08-28T10:00:00Z",
  "last_at": "2026-08-28T10:05:00Z",
  "message_count": 4,
  "preview": "How do I reset my password?",
  "messages": [
    {
      "id": 1,
      "role": "user",
      "text": "How do I reset my password?",
      "source": null,
      "created_at": "2026-08-28T10:00:00Z"
    },
    {
      "id": 2,
      "role": "assistant",
      "text": "You can reset by clicking 'Forgot Password'.",
      "source": "Custom Q&A",
      "created_at": "2026-08-28T10:00:15Z"
    }
  ]
}
```

**Response (403 Forbidden):**
```json
{
  "error": "Permission denied"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Conversation not found"
}
```

---

#### GET /api/assistant/conversations/me/

Get conversations for the current user (non-admin).

**Request:**
```
GET /api/assistant/conversations/me/
```

**Response (200 OK):** Same format as GET /api/assistant/conversations/

---

## 🔧 Frontend Integration

### Using the Assistant API

The frontend provides a service layer at `frontend/src/services/assistantApi.ts`:

```typescript
import {
  adminGetConfig,
  adminUpdateConfig,
  adminListQA,
  adminCreateQA,
  adminUpdateQA,
  adminDeleteQA,
  adminListConversations,
  adminGetConversation,
  type AssistantAdminConfig,
  type AssistantQA,
  type AssistantConversation,
} from "../../services/assistantApi";
```

### Example: Loading Conversations

```typescript
import { useEffect, useState } from 'react';
import { adminListConversations, adminGetConversation } from '../../services/assistantApi';

function ConversationsTab() {
  const [list, setList] = useState<AssistantConversation[] | null>(null);
  const [sel, setSel] = useState<AssistantConversation | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    adminListConversations().then(setList).catch(handleError);
  }, []);

  function open(id: number) {
    setLoadingDetail(true);
    setSel(null);
    adminGetConversation(id)
      .then(setSel)
      .catch(handleError)
      .finally(() => setLoadingDetail(false));
  }

  // Render logic...
}
```

### Error Handling

The API uses custom error types:

```typescript
import { UnauthorizedError } from "../../services/api";

function guard(e: unknown): boolean {
  if (e instanceof UnauthorizedError) {
    onUnauthorized();
    return true;
  }
  return false;
}

// Usage in async operations
adminGetConversation(id)
  .then(setSel)
  .catch((e) => { if (!guard(e)) setErr("Could not load conversation."); });
```

---

## 📊 Response Codes

| Code | Description | When Used |
|------|-------------|-----------|
| 200 | OK | Successful GET, PUT requests |
| 201 | Created | Successful POST requests |
| 204 | No Content | Successful DELETE requests |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Server-side errors |

---

## 🚀 Rate Limiting

**Note**: Rate limiting may be implemented in production.

| Endpoint | Limit | Window |
|----------|-------|--------|
| All GET endpoints | 100 requests | 1 minute |
| All POST/PUT/DELETE | 30 requests | 1 minute |

---

## 🔍 Pagination

List endpoints support pagination:

```
GET /api/assistant/qa/?limit=25&offset=50
```

**Response Headers:**
```
X-Total-Count: 100
X-Page-Size: 25
X-Page: 3
```

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-08-28 | Initial API documentation |

---

## 🎓 See Also

- [Architecture Documentation](../architecture/assistant.md)
- [User Flows](../user-flows/assistant.md)
- [Database Schema](../database/assistant.md)
- [Frontend Component: AssistantWidget](../../frontend/src/components/assistant/AssistantWidget.tsx)
- [Admin Page: AssistantAdmin](../../frontend/src/pages/admin/AssistantAdmin.tsx)

---

*Last updated: 2026-08-28*
*API Version: 1.0.0*
