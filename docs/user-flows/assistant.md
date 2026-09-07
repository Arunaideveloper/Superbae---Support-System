# AI Assistant User Flows

## 👥 Overview

This document describes the complete user experience flows for the **AI Assistant** feature, covering both **end-user interactions** and **administrative workflows**.

---

## 🎯 User Types & Permissions

| User Type | Access Level | Can Use | Can Manage |
|-----------|--------------|---------|------------|
| **Guest** | Public access | ❌ No | ❌ No |
| **User** | Authenticated | ✅ Yes | ❌ No |
| **Agent** | Support staff | ✅ Yes | ❌ No (read-only admin) |
| **Admin** | Full access | ✅ Yes | ✅ Yes |

---

## 💬 End-User Flows

### Flow 1: First-Time User Opens Chat

```
┌─────────────────────────────────────────────────────────────────────────┐
│  USER ACTION                    │  SYSTEM RESPONSE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User clicks "Ask Assistant"  │  1. Widget opens with animation             │
│     button or icon              │     - Slide in from bottom right            │
│                                │     - Show welcome message                   │
│  2. User sees welcome screen    │  2. Display:                                  │
│                                │     - Assistant name (from config)           │
│                                │     - Greeting message (from config)         │
│                                │     - Suggested questions chips               │
│                                │     - Input field with placeholder            │
│                                │     - Send button                             │
│  3. User clicks suggested      │  3. Auto-fill input with question             │
│     question                    │     - Focus on input field                   │
│                                │     - Ready for user to edit or send          │
│  4. User types or edits         │  4. Real-time:                               │
│     question                    │     - Show typing indicator if delayed >500ms│
│                                │     - Enable/disable send button              │
│  5. User presses Enter or       │  5. Process message:                         │
│     clicks Send                 │     - Show loading spinner                   │
│                                │     - Disable input temporarily               │
│                                │     - Add user message to UI immediately      │
│                                │     - Scroll to bottom                        │
│                                │     - Call API: POST /api/assistant/chat/     │
│  6. Wait for response           │  6. Backend processing:                     │
│                                │     - Match against custom Q&A                │
│                                │     - Search knowledge base                   │
│                                │     - Generate response                        │
│                                │     - Log conversation                        │
│                                │     - Return JSON response                    │
│  7. Response received           │  7. Display assistant message:                │
│                                │     - Add to message list                      │
│                                │     - Style: left-aligned, purple bg          │
│                                │     - Show source attribution if available     │
│                                │     - Scroll to bottom                        │
│                                │     - Re-enable input                         │
│  8. User sees response          │  8. If source = "KB Article":                │
│                                │     - Show "via Knowledge Base"               │
│                                │     - Link to article (optional)              │
│                                │     If source = "Custom Q&A":                 │
│                                │     - Show "via Custom Q&A"                   │
│                                │     If no match:                              │
│                                │     - Show "I couldn't find an answer..."      │
│                                │     - Offer to create ticket                  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Visual Representation:**
```
User clicks chat → Widget opens → Sees welcome → Types question → Sends message
    ↓                    ↓              ↓                   ↓            ↓
    │                    │              │                   │            │
    ▼                    ▼              ▼                   ▼            ▼
Show widget      Display greeting   Auto-fill        API call      Show response
   │                 │             (if suggested)      │            │
   │                 │                         │            │
   ▼                 ▼                         ▼            ▼
Annotate       Show chips              User edits    Backend
 widget                                                    processing
                                                     │
                                                     ▼
                                              Match & respond
                                                     │
                                                     ▼
                                              Return JSON
                                                     │
                                                     ▼
                                               Display
```

---

### Flow 2: Follow-up Questions (Conversation Context)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SCREENSHOT: Conversation with context                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  [User Message] How do I reset my password?                        │   │
│  │  ↓                                                            │   │
│  │  [Assistant] You can reset by clicking 'Forgot Password' on...     │   │
│  │              via Custom Q&A                                      │   │
│  │  ↓                                                            │   │
│  │  [User Message] What if I don't have access to my email?          │   │
│  │  ↓                                                            │   │
│  │  [Assistant] You can contact support directly...                    │   │
│  │              via Custom Q&A                                      │   │
│  │  ↓                                                            │   │
│  │  [User Input] ...                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

**Process:**
1. User asks first question → Gets answer
2. User asks follow-up question → System processes independently
   - Current: No conversation context maintained
   - Future: Context window for multi-turn conversations
3. Each message treated as independent query
4. Conversation history displayed for user reference

---

### Flow 3: User Clicks Suggested Question

```
┌─────────────────────────────────────────────────────────────────────────┐
│  INTERACTION SEQUENCE                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User sees suggested questions (chips) below input                      │
│     Example chips:                                                         │
│     - "How do I reset my password?"                                        │
│     - "What are your support hours?"                                      │
│     - "How do I contact an agent?"                                         │
│                                                                             │
│  2. User clicks a chip                                                     │
│     → Chip text auto-fills into input field                               │
│     → Input field receives focus                                         │
│     → User can:                                                            │
│       a) Press Enter to send immediately                                   │
│       b) Edit the question before sending                                  │
│       c) Click another chip (replaces text)                                │
│                                                                             │
│  3. User sends the question                                                │
│     → Message processed normally                                          │
│     → Response generated and displayed                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Flow 4: No Answer Found - Escalate to Ticket

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ESCALATION FLOW                                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User asks: "How do I integrate with Service X?"                         │
│                                                                             │
│  2. Assistant responds:                                                     │
│     "I'm sorry, I couldn't find an answer to your question.                │
│      Would you like me to create a support ticket for you?"                │
│                                                                             │
│     [Yes, create ticket]  [No, try something else]                        │
│                                                                             │
│  3. User clicks "Yes, create ticket"                                       │
│     → Widget shows: "Creating ticket..."                                  │
│     → API call: POST /api/tickets/ with conversation context               │
│     → Ticket created with:                                                │
│       - Title: First message or summary                                   │
│       - Description: Full conversation transcript                         │
│       - Category: Derived from context or default                         │
│       - Priority: Normal (or based on keywords)                            │
│                                                                             │
│  4. Confirmation displayed:                                                │
│     "✓ Support ticket #12345 created!"                                    │
│     "An agent will review your request shortly."                           │
│     [View Ticket]  [Continue Chat]                                          │
│                                                                             │
│  5. User can:                                                               │
│     a) Click "View Ticket" → Redirects to /tickets/12345                 │
│     b) Click "Continue Chat" → Stays in widget, clears input               │
│     c) Close widget → Returns to previous page                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Flow 5: Widget Minimize/Close

```
┌─────────────────────────────────────────────────────────────────────────┐
│  WIDGET LIFECYCLE                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OPEN STATES:                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  STATE: Closed                                                     │   │
│  │  - Only button/icon visible                                        │   │
│  │  - Button: "Ask Superbae" or chat icon                            │   │
│  │  - Unread badge if new messages from assistant                     │   │
│  │  - On click: Opens to full widget                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  STATE: Open                                                       │   │
│  │  - Full chat interface visible                                     │   │
│  │  - Shows message history                                           │   │
│  │  - Input field active                                              │   │
│  │  - Header with assistant name                                       │   │
│  │  - Minimize button (↓)                                             │   │
│  │  - Close button (✕)                                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│          ┌─────────────────────┬─────────────────────┐                │
│          ▼                     ▼                         ▼                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │   Click         │  │   Click         │  │   Click Outside  │        │
│  │   Minimize (↓)  │  │   Close (✕)    │  │   (anywhere)     │        │
│  │                │  │                 │  │                 │        │
│  │  → Minimized   │  │  → Closed       │  │  → Closed       │        │
│  │     state      │  │     state      │  │     state       │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  STATE: Minimized                                                  │   │
│  │  - Only header visible with unread count                           │   │
│  │  - Shows: "Superbae Assistant (3)"                                 │   │
│  │  - Click to expand back to open state                               │   │
│  │  - Hover shows preview of latest message                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 👔 Administrative Flows

### Flow A: Admin Views Assistant Dashboard

**Reference:** `frontend/src/pages/admin/AssistantAdmin.tsx` (lines 241-277)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ADMIN NAVIGATION                                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Admin logs in and navigates to Admin Dashboard                         │
│                                                                             │
│  2. Clicks "Assistant" in sidebar or top navigation                        │
│     → Route: /admin/assistant                                            │
│     → Component: AssistantAdmin                                           │
│                                                                             │
│  3. Sees tab navigation:                                                 │
│     [Settings] [Custom Q&A] [Conversations]                               │
│     Default: Settings tab active                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Flow B: Admin Manages Settings (Tab 1)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SETTINGS TAB FLOW                                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Settings tab displays:                                                │
│     ┌─────────────────────────────────────────────────────────────┐   │
│     │  Assistant enabled: [Toggle ON/OFF]                          │   │
│     │                                                                 │   │
│     │  Assistant name: [Input: Superbae Assistant      ]           │   │
│     │                                                                 │   │
│     │  Welcome message: [Textarea                          ]           │   │
│     │                  How can I help you today?           ]           │   │
│     │                                                                 │   │
│     │  Suggested questions:                                            │   │
│     │  [Input 1] How do I reset my password?        [✕]             │   │
│     │  [Input 2] What are your support hours?       [✕]             │   │
│     │  [Input 3] How do I contact an agent?          [✕]             │   │
│     │  [+ Add] button                                                   │   │
│     │                                                                 │   │
│     │  [Save changes] button                                            │   │
│     └─────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  2. Admin toggles "Assistant enabled" OFF                                │
│     → Widget immediately hides for all users (no page reload)            │
│     → Toggle animates: slides from ON to OFF position                   │
│                                                                             │
│  3. Admin updates assistant name                                           │
│     → Typing in input field                                               │
│     → "Saved ✓" message disappears if previously shown                    │
│                                                                             │
│  4. Admin adds new suggested question                                      │
│     → Clicks "+ Add" button                                              │
│     → New empty input appears at bottom of list                          │
│     → Admin types question                                               │
│     → Can delete by clicking ✕                                           │
│                                                                             │
│  5. Admin clicks "Save changes"                                          │
│     → Button shows "Saving..." and disables                                │
│     → API: PUT /api/assistant/config/                                     │
│     → On success: "Saved ✓" appears beside button                          │
│     → Auto-hides after 3 seconds                                          │
│     → On error: Error message appears at top                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

**Code Reference (from AssistantAdmin.tsx lines 241-277):**
```typescript
// ConversationsTab component structure
function ConversationsTab({ guard, setErr }: { 
  guard: (e: unknown) => boolean; 
  setErr: (s: string) => void 
}) {
  const [list, setList] = useState<AssistantConversation[] | null>(null);
  const [sel, setSel] = useState<AssistantConversation | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load conversation list on mount
  useEffect(() => { 
    adminListConversations()
      .then(setList) 
      .catch((e) => { if (!guard(e)) setErr("Could not load conversations."); }); 
  }, []);

  // Open conversation detail
  function open(id: number) {
    setLoadingDetail(true); 
    setSel(null);
    adminGetConversation(id)
      .then(setSel) 
      .catch((e) => { if (!guard(e)) setErr("Could not load conversation."); }) 
      .finally(() => setLoadingDetail(false));
  }

  if (!list) return <p style={{ color: colors.muted }}>Loading…</p>;

  // Render conversation list or detail view
  if (sel || loadingDetail) {
    return (
      <div>
        <button onClick={() => setSel(null)}>← All conversations</button>
        {loadingDetail || !sel ? 
          <p>Loading…</p> : 
          <div style={{ ...card, padding: 20 }}>
            <div>{sel.user} · started {fmt(sel.started_at)}</div>
            <div>
              {sel.messages?.map((m) => (
                <div key={m.id} style={{ 
                  display: "flex", 
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start" 
                }}>
                  <div style={{ 
                    maxWidth: "78%", 
                    background: m.role === "user" ? "#FCEEF3" : "#F4EFFC"
                  }}>
                    {m.text}
                    {m.role === "assistant" && m.source && 
                      <div>via {m.source}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
      </div>
    );
  }

  // Show conversation list
  return (
    <div>
      <p>{list.length} conversation{list.length !== 1 ? "s" : ""} logged.</p>
      <div>
        {list.map((c) => (
          <div key={c.id} onClick={() => open(c.id)}>
            <div>{c.user} · {c.message_count} messages</div>
            <div>"{c.preview || "…"}"</div>
            <div>{fmt(c.last_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### Flow C: Admin Manages Custom Q&A (Tab 2)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CUSTOM Q&A TAB FLOW                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Q&A tab displays list view:                                            │
│     ┌─────────────────────────────────────────────────────────────┐   │
│     │  [+ Add Q&A] button (top right)                               │   │
│     │                                                                 │   │
│     │  Q&A Item 1:                                                  │   │
│     │  ┌─────────────────────────────────────────────────────┐   │   │
│     │  │ Q: How do I reset my password?                          │   │   │
│     │  │ A: Click 'Forgot Password' on the login page...         │   │   │
│     │  │ 🔎 reset, password, forgot, login                         │   │   │
│     │  │ [✏️ Edit] [🗑 Delete] [Toggle: Active/Inactive]         │   │   │
│     │  └─────────────────────────────────────────────────────┘   │   │
│     │                                                                 │   │
│     │  Q&A Item 2:                                                  │   │
│     │  ┌─────────────────────────────────────────────────────┐   │   │
│     │  │ Q: What are your support hours?                          │   │   │
│     │  │ A: We're available 24/7!                                 │   │   │
│     │  │ [✏️ Edit] [🗑 Delete] [Toggle: Active/Inactive]         │   │   │
│     │  └─────────────────────────────────────────────────────┘   │   │
│     │                                                                 │   │
│     │  Empty state: "No custom answers yet. Add one to get..."     │   │
│     └─────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  2. Admin clicks "+ Add Q&A"                                              │
│     → Opens modal/form:                                                   │
│     ┌─────────────────────────────────────────────────────────────┐   │
│     │  New Q&A                                                       │   │
│     │  ┌─────────────────────────────────────────────────────┐   │   │
│     │  │ Question: [Input                                   ]       │   │   │
│     │  │ Answer: [Textarea (4 rows)                      ]       │   │   │
│     │  │                          (bold and bullets supported)      │   │   │
│     │  │ Match keywords: [Input] reset, password            ]       │   │   │
│     │  │ Order: [Input: 0          ]                                │   │   │
│     │  │                                                        │   │   │
│     │  │ [Save] [Cancel]                                         │   │   │
│     │  └─────────────────────────────────────────────────────┘   │   │
│     └─────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  3. Admin fills form and clicks "Save"                                     │
│     → Validates: question and answer required                              │
│     → If validation fails: shows error "Question and answer are required"   │
│     → If valid: API POST /api/assistant/qa/                               │
│     → On success: modal closes, list refreshes                             │
│     → New item appears at top (ordered by order field)                    │
│                                                                             │
│  4. Admin clicks ✏️ Edit on existing Q&A                                   │
│     → Opens same modal with pre-filled values                            │
│     → Title changes to "Edit Q&A"                                         │
│     → On save: API PUT /api/assistant/qa/{id}/                              │
│                                                                             │
│  5. Admin clicks 🗑 Delete on Q&A                                           │
│     → Confirmation: "Are you sure you want to delete this Q&A?"           │
│     → On confirm: API DELETE /api/assistant/qa/{id}/                       │
│     → Item removed from list immediately (optimistic update)               │
│                                                                             │
│  6. Admin toggles Active/Inactive                                          │
│     → Immediate visual feedback (opacity change)                           │
│     → API: PUT /api/assistant/qa/{id}/ with {active: !current}             │
│     → No page reload needed                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Flow D: Admin Views Conversations (Tab 3)

**Reference:** Lines 241-277 of `AssistantAdmin.tsx` show the complete implementation.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CONVERSATIONS TAB FLOW                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Conversations tab displays list:                                       │
│     ┌─────────────────────────────────────────────────────────────┐   │
│     │  "15 conversations logged. Click one to read the full chat."  │   │
│     │                                                                 │   │
│     │  Conversation Item 1: (clickable)                              │   │
│     │  ┌─────────────────────────────────────────────────────┐   │   │
│     │  │ john.doe@email.com · 4 messages                        │   │   │
│     │  │ "How do I reset my password?"                        │   │   │
│     │  │        Aug 28, 2026 at 10:05 AM                        │   │   │
│     │  └─────────────────────────────────────────────────────┘   │   │
│     │                                                                 │   │
│     │  Conversation Item 2:                                            │   │
│     │  ┌─────────────────────────────────────────────────────┐   │   │
│     │  │ jane.smith@email.com · 2 messages                       │   │   │
│     │  │ "What are your support hours?"                        │   │   │
│     │  │        Aug 28, 2026 at 9:30 AM                         │   │   │
│     │  └─────────────────────────────────────────────────────┘   │   │
│     │                                                                 │   │
│     │  Empty state: "No conversations yet."                         │   │
│     └─────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  2. Admin clicks a conversation                                              │
│     → Loading state: "Loading..."                                           │
│     → API: GET /api/assistant/conversations/{id}/                          │
│     → On success: Shows detail view                                         │
│     → On error: Shows error message                                         │
│                                                                             │
│  3. Detail view displays:                                                  │
│     ┌─────────────────────────────────────────────────────────────┐   │
│     │  ← All conversations (back button)                             │   │
│     │                                                                 │   │
│     │  john.doe@email.com · started Aug 28, 2026 at 10:00 AM           │   │
│     │  ─────────────────────────────────────────────────────────  │   │
│     │                                                                 │   │
│     │          [User Message] How do I reset my password?           │   │
│     │                    (right-aligned, pink bg)                    │   │
│     │                                                                 │   │
│     │          [Assistant] You can reset by clicking...             │   │
│     │                    (left-aligned, purple bg)                   │   │
│     │                    via Custom Q&A                             │   │
│     │                    (small, faint text)                          │   │
│     │                                                                 │   │
│     │          [User Message] What if I don't have email access?     │   │
│     │                                                                 │   │
│     │          [Assistant] You can contact support...               │   │
│     │                                                                 │   │
│     └─────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  4. Admin can:                                                               │
│     a) Click "← All conversations" to return to list                       │
│     b) Scroll through message history                                      │
│     c) Copy text from messages                                              │
│     d) Note: Messages are read-only (no editing)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 UI States & Transitions

### Widget States

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│   CLOSED             │     │   MINIMIZED           │     │   OPEN               │
│                      │     │                      │     │                      │
│  [Ask Assistant]     │────▶│  Assistant (3)       │────▶│  Full chat UI        │
│  Chat icon           │     │  ↓                   │     │                      │
│  Unread badge: 0     │◀────│  Click to expand      │◀────│  Messages           │
│                      │     │  Hover for preview    │     │  Input field         │
└──────────────────────┘     └──────────────────────┘     │  Suggested questions  │
                                                           │  Send button          │
                                                           └──────────────────────┘
```

### Loading States

1. **Initial Load**: Widget shows skeleton loader
2. **Sending Message**: Input disabled, spinner in send button
3. **Waiting for Response**: Typing indicator (3 dots animation)
4. **Conversation Detail Load**: "Loading..." text, back button still active

### Error States

1. **Network Error**: Red error message at top of widget
2. **API Error**: "Could not connect to assistant service"
3. **Empty Response**: "Assistant didn't respond"
4. **Authentication Required**: Redirect to login

---

## 📊 Analytics & Tracking

### User Interaction Metrics

| Event | Trigger | Data Collected |
|-------|---------|----------------|
| `assistant_open` | Widget opened | Timestamp, user_id |
| `assistant_close` | Widget closed | Duration, message_count |
| `assistant_message_sent` | User sends message | Message text, timestamp |
| `assistant_response_received` | Response displayed | Source, timestamp |
| `assistant_suggestion_click` | Suggested question clicked | Suggestion text |
| `assistant_ticket_escalation` | Ticket created from chat | Ticket ID, conversation ID |

### Conversation Metrics

| Metric | Calculation | Use Case |
|--------|-------------|----------|
| Average Response Time | (response_time - request_time) avg | Performance monitoring |
| Match Accuracy | % of questions matched to Q&A or KB | Improve Q&A coverage |
| Resolution Rate | % of conversations without escalation | Measure effectiveness |
| Conversation Length | Average messages per conversation | Understand usage patterns |

---

## 🎯 Success Criteria

### User Success Metrics

1. **First Contact Resolution**: % of user questions resolved in chat
2. **User Satisfaction**: Positive feedback on assistant responses
3. **Reduced Ticket Volume**: Fewer tickets created for common questions
4. **Engagement**: Number of interactions per user

### Admin Success Metrics

1. **Configuration Completeness**: All settings properly configured
2. **Q&A Coverage**: % of common questions with custom answers
3. **Response Quality**: Average rating of assistant responses
4. **Monitoring Coverage**: All conversations logged and reviewable

---

## 🚫 Edge Cases & Error Handling

### User-Facing Errors

| Scenario | Error Message | Recovery |
|----------|---------------|----------|
| Network timeout | "Connection lost. Please try again." | Auto-retry after 3 seconds |
| API error | "Something went wrong. Please refresh." | Show retry button |
| Empty response | "Assistant didn't respond. Try again." | Keep input for retry |
| Rate limited | "Too many requests. Please wait." | Disable input for 60s |

### Admin-Facing Errors

| Scenario | Error Message | Recovery |
|----------|---------------|----------|
| Save failure | "Could not save settings." | Keep form, show error |
| Delete failure | "Could not delete Q&A." | Keep item, show error |
| Load failure | "Could not load conversations." | Show empty state |
| Unauthorized | "Access denied." | Redirect to login |

---

## 📱 Responsive Behavior

### Desktop (>768px)
- Widget: 400px wide, fixed position bottom right
- Message bubbles: Max 78% width
- Sidebar: Visible on left

### Tablet (768px - 1024px)
- Widget: 350px wide
- Message bubbles: Max 85% width
- Full-width layout

### Mobile (<768px)
- Widget: Full width at bottom
- Message bubbles: Max 90% width
- Input: Full width
- Suggested questions: 2 columns

---

## 🎨 Accessibility

### Keyboard Navigation
- Tab: Move between input, buttons, suggested questions
- Enter: Send message (when input focused)
- Escape: Close widget
- Arrow Up/Down: Navigate suggested questions

### Screen Reader Support
- All interactive elements have proper labels
- Message role announced ("User message", "Assistant response")
- Loading states announced
- Error messages announced immediately

### Color Contrast
- All text meets WCAG 2.1 AA contrast ratios
- Message bubbles have clear visual distinction
- Interactive elements have visible focus states

---

## 🔗 Related Components

| Component | File | Purpose |
|-----------|------|---------|
| AssistantWidget | `frontend/src/components/assistant/AssistantWidget.tsx` | User chat interface |
| AssistantAdmin | `frontend/src/pages/admin/AssistantAdmin.tsx` | Admin configuration |
| assistantApi | `frontend/src/services/assistantApi.ts` | API service layer |

---

## 📚 See Also

- [API Reference](../api/assistant.md) - Complete endpoint documentation
- [Architecture Documentation](../architecture/assistant.md) - Technical architecture
- [Database Schema](../database/assistant.md) - Data models
- [Component Implementation](../../frontend/src/components/assistant/AssistantWidget.tsx)
- [Admin Implementation](../../frontend/src/pages/admin/AssistantAdmin.tsx)

---

*Last updated: 2026-08-28*
*Version: 1.0.0*
