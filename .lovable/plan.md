

## Plan: Separate Recipient Selection into a Dedicated Dialog

### Overview
Move the recipient selection UI out of `SendMessageDialog` into a new sub-dialog (`SelectRecipientsDialog`). The main send dialog will show selected recipients as badges with an "Add Recipients" button. Clicking it opens the new dialog with members grouped by team, including a search bar.

### Changes

**1. Create `src/components/messages/SelectRecipientsDialog.tsx`**
- A new Dialog component that receives `selectedIds`, `onConfirm(ids)`, and `open/onOpenChange` props
- Fetches members and teams (reuses existing queries)
- Groups members by team using an Accordion or collapsible sections (team name as header)
- Members without a team grouped under "미배정" (Unassigned)
- Checkbox-based multi-select within each team group
- Search input at the top to filter members by name across all teams
- "Select All" per team group option
- Footer with Cancel / Confirm buttons
- Excludes the current user from the list

**2. Update `src/components/messages/SendMessageDialog.tsx`**
- Remove the inline member list, search input, and ScrollArea
- Replace with a clickable area showing selected recipient badges + an "수신자 선택" button (with UserPlus icon)
- Clicking the button opens `SelectRecipientsDialog`
- On confirm, update `selectedIds` state
- Keep all existing send logic unchanged

### UI Layout

```text
┌─ SendMessageDialog ──────────────┐
│ 메시지 보내기                     │
│                                   │
│ [연결된 업무 카드] (if task)       │
│                                   │
│ 수신자:                           │
│ [Badge1 ✕] [Badge2 ✕]            │
│ [+ 수신자 선택] ← opens sub-dialog│
│                                   │
│ 메시지:                           │
│ [textarea]                        │
│                                   │
│              [취소] [전송]         │
└───────────────────────────────────┘

┌─ SelectRecipientsDialog ─────────┐
│ 수신자 선택                       │
│ [🔍 이름 검색...]                │
│                                   │
│ ▼ Design (DES)                   │
│   ☐ Member A                     │
│   ☑ Member B                     │
│ ▼ Construction (CON)             │
│   ☑ Member C                     │
│   ☐ Member D                     │
│ ▼ 미배정                         │
│   ☐ Member E                     │
│                                   │
│              [취소] [확인 (2명)]   │
└───────────────────────────────────┘
```

### Technical Details
- `SelectRecipientsDialog` manages a local copy of selected IDs, only committing on confirm
- Uses `Accordion` from shadcn/ui for team grouping (all expanded by default)
- No database or schema changes needed

