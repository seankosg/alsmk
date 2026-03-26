

# CPM 매핑 다이얼로그 크기 확대

## 변경 파일: `src/components/cpm/MapActivitiesDialog.tsx`

### 변경 내용 (line 114)

```text
변경 전: className="flex max-h-[80vh] max-w-lg min-h-0 flex-col overflow-hidden"
변경 후: className="flex max-h-[80vh] max-w-2xl min-h-[60vh] flex-col overflow-hidden"
```

- `max-w-lg` (512px) → `max-w-2xl` (672px): 가로 폭 확대
- `min-h-[60vh]` 추가: 최소 높이를 화면의 60%로 설정하여 Activity 목록이 충분히 보이도록 함

