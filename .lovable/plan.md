

# SnapshotManager가 ActivityTaskPanel을 가리는 문제 수정

## 문제

`SnapshotManager`는 `absolute top-2 right-2 z-10`으로 배치되어 있고, `ActivityTaskPanel`은 오른쪽 360px 영역에 표시됩니다. 패널이 열리면 SnapshotManager가 패널 위에 겹쳐져 ✕ 닫기 버튼을 가립니다.

## 수정: `src/pages/CpmScheduler.tsx`

SnapshotManager의 `right` 위치를 패널 열림 여부에 따라 조정:

```text
변경 전: className="absolute top-2 right-2 z-10"
변경 후: className={`absolute top-2 z-10 ${selectedActivity ? 'right-[370px]' : 'right-2'}`}
```

패널(360px)이 열리면 SnapshotManager를 패널 왼쪽으로 이동시켜 겹침을 방지합니다.

