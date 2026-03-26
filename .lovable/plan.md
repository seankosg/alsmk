

# BLDG(customFields) 값 로딩 안 되는 문제 수정

## 원인

DB에서 최신 `auto` 스냅샷을 조회한 결과, activity 데이터에 **`customFields` 프로퍼티가 완전히 누락**되어 있습니다.

```text
최신 auto 스냅샷 (382개 activity): customFields = null  ← 문제
이전 수동 스냅샷 4.2 (383개 activity): customFields = {Text1:"공통", Text2:"MS"}  ← 정상
```

**유실 경로**: 어느 시점에 customFields 없는 상태로 auto 스냅샷이 저장 → 다른 기기에서 이 스냅샷을 복원 → customFields 없는 activities → BLDG 표시 안 됨.

`customFields`는 XML 파싱 시에만 설정되며, 스냅샷 복원 → `calculate(true)` 과정에서는 XML 재파싱이 없으므로 한번 유실되면 복구 불가합니다.

## 해결 방법

### 1차: DB `cpm_activities` 테이블에서 customFields 복구 (즉시 효과)

`cpm_activities.custom_fields` 컬럼에는 XML 업로드 시 `upsertActivities`로 저장된 데이터가 남아 있습니다. 스냅샷 복원 후 **DB에서 customFields를 보충**하는 로직을 추가합니다.

**변경: `src/pages/CpmScheduler.tsx`** — `loadSnapshotFromDb` 함수 수정

스냅샷을 iframe에 전송한 후, `cpm_activities` 테이블에서 `custom_fields`를 조회하여 iframe에 별도 메시지(`patch-custom-fields`)로 전송합니다.

```javascript
// loadSnapshotFromDb 끝에 추가
const { data: dbActivities } = await supabase
  .from("cpm_activities")
  .select("mpp_task_id, wbs_full, custom_fields");

if (dbActivities?.length) {
  const cfMap = {};
  dbActivities.forEach(a => {
    if (a.custom_fields && Object.keys(a.custom_fields).length) {
      cfMap[`${a.mpp_task_id}::${a.wbs_full}`] = a.custom_fields;
    }
  });
  iframeRef.current.contentWindow.postMessage(
    { type: "patch-custom-fields", fieldMap: cfMap }, "*"
  );
}
```

**변경: `public/cpm_network.html`** — 메시지 핸들러 추가

```javascript
if (e.data.type === 'patch-custom-fields') {
  const fm = e.data.fieldMap;
  let patched = 0;
  activities.forEach(a => {
    const key = `${a.mppTaskId}::${a.wbsFull}`;
    if (fm[key] && (!a.customFields || !Object.keys(a.customFields).length)) {
      a.customFields = fm[key];
      patched++;
    }
  });
  if (patched > 0) {
    drawNetwork(topoOrder, activityMap, projectEnd, window._activeWbsFilter, window._activeBldgFilter);
  }
}
```

### 2차: auto 스냅샷 저장 시 customFields 보존 보장

`postSnapshotSave()` 전에 activities에 customFields가 없는 경우, DB에서 보충 후 저장하도록 하면 향후 유실을 방지합니다. 하지만 이미 `_makeSnapshot`에서 `...a` 스프레드로 포함하고 있으므로, 1차 패치가 적용되면 자연스럽게 해결됩니다.

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/pages/CpmScheduler.tsx` | `loadSnapshotFromDb`에서 스냅샷 전송 후 `cpm_activities.custom_fields`로 패치 메시지 전송 |
| `public/cpm_network.html` | `patch-custom-fields` 메시지 핸들러 추가: 누락된 customFields 보충 후 redraw |

