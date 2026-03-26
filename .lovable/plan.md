

# ExtendedAttribute 커스텀 필드 범용 파싱 및 JSONB 저장

## 개요

MS Project XML의 `ExtendedAttribute` 커스텀 필드(BLDG 등)를 자동 파싱하여 `cpm_activities` 테이블의 JSONB 컬럼에 저장하는 범용 구조를 구현합니다.

## MS Project XML ExtendedAttribute 구조

```text
<ExtendedAttributes>          ← 프로젝트 레벨: 필드 정의
  <ExtendedAttribute>
    <FieldID>188743731</FieldID>
    <FieldName>Text1</FieldName>
    <Alias>BLDG</Alias>        ← 사용자가 지정한 이름
  </ExtendedAttribute>
</ExtendedAttributes>

<Task>
  <ExtendedAttribute>          ← 태스크 레벨: 값
    <FieldID>188743731</FieldID>
    <Value>Building A</Value>
  </ExtendedAttribute>
</Task>
```

## 변경 사항

### 1. DB 마이그레이션: `cpm_activities`에 `custom_fields` JSONB 컬럼 추가

```sql
ALTER TABLE cpm_activities ADD COLUMN custom_fields jsonb DEFAULT '{}'::jsonb;
```

저장 형태 예시:
```json
{ "BLDG": "Building A", "AREA": "Zone 1", "Text3": "some value" }
```

### 2. `public/cpm_network.html` — `parseMSProjectXML` 수정

**Step 1**: 프로젝트 레벨 `ExtendedAttributes` 파싱하여 `FieldID → Alias(또는 FieldName)` 매핑 테이블 생성

```text
fieldIdToName = { "188743731": "BLDG", "188743732": "AREA", ... }
```

**Step 2**: 각 Task의 `ExtendedAttribute` 자식 요소를 순회하여 `FieldID`로 이름을 찾고 `Value`를 추출

```text
act.customFields = { "BLDG": "Building A", "AREA": "Zone 1" }
```

### 3. `public/cpm_network.html` — `postCpmCalculated` 수정

`cpm-calculated` 메시지 데이터에 `customFields` 포함:

```text
변경 전: { id, name, duration, ..., tf }
변경 후: { id, name, duration, ..., tf, customFields }
```

### 4. `src/pages/CpmScheduler.tsx` — `upsertActivities` 수정

upsert row에 `custom_fields` 필드 추가:

```text
custom_fields: a.customFields || {}
```

### 5. `src/components/cpm/ActivityTaskPanel.tsx` — 커스텀 필드 표시

Activity Detail 뷰에서 `custom_fields`가 비어있지 않으면 키-값 쌍을 표시:

```text
── Custom Fields ──
BLDG: Building A
AREA: Zone 1
```

### 6. CPM 노드 표시 (선택적)

iframe 내 노드에 주요 커스텀 필드(예: BLDG)를 표시할 수 있으나, 범용 구조이므로 우선 ActivityTaskPanel에만 표시합니다.

## 변경 파일 요약

| 파일 | 변경 |
|------|------|
| DB 마이그레이션 | `cpm_activities`에 `custom_fields jsonb` 컬럼 추가 |
| `public/cpm_network.html` | ExtendedAttribute 파싱 + postMessage에 customFields 포함 |
| `src/pages/CpmScheduler.tsx` | upsert에 `custom_fields` 필드 추가 |
| `src/components/cpm/ActivityTaskPanel.tsx` | Detail 뷰에 커스텀 필드 표시 |

