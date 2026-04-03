

# KUKU Predecessor Watch — 호버 툴팁 추가

## 변경 내용

### `src/components/dashboard/KukuPredecessorWatch.tsx`

각 지연 Activity 행을 `HoverCard`로 감싸서, 마우스를 올리면 큰 글씨로 상세 정보를 표시합니다.

**HoverCard 내용 (큰 글씨):**
- Activity 이름 (`text-base font-semibold`)
- WBS 코드 + CP/Text1 뱃지
- Actual / Plan / Gap (각 `text-sm`)
- 지연일수 D+N (있을 경우)
- 후행 KUKU 작업 목록
- 완료일 (finish_date)

**임포트 추가:**
```typescript
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
```

**구조 변경:**
```text
기존: <div onClick=...> ... </div>
변경: <HoverCard>
        <HoverCardTrigger asChild>
          <div onClick=...> ... (기존 행 그대로) </div>
        </HoverCardTrigger>
        <HoverCardContent side="top" className="w-80">
          큰 글씨 상세 정보
        </HoverCardContent>
      </HoverCard>
```

| 파일 | 내용 |
|------|------|
| `src/components/dashboard/KukuPredecessorWatch.tsx` | HoverCard 래핑 + 상세 툴팁 |

