

# CPM 스냅샷 로딩 인디케이터

## 개요

새 브라우저 접속 시 DB 스냅샷을 가져오는 동안 사용자에게 로딩 상태를 표시합니다. 현재는 샘플 데이터가 먼저 표시되었다가 DB 스냅샷이 도착하면 교체되어 혼란스럽습니다.

## 변경: `public/cpm_network.html`

### 1. 로딩 오버레이 HTML 추가 (body 내)

네트워크 캔버스 위에 반투명 오버레이 + 스피너 + 메시지:

```html
<div id="loadingOverlay" style="display:none; position:fixed; inset:0; 
  background:rgba(0,0,0,0.7); z-index:9999; display:flex; 
  align-items:center; justify-content:center; flex-direction:column;">
  <div class="spinner"></div>
  <div style="color:#fff; margin-top:16px; font-size:14px;">
    서버에서 CPM 데이터를 불러오는 중...
  </div>
</div>
```

CSS 스피너 애니메이션 추가.

### 2. Init 구간 수정 (~line 2761-2766)

localStorage가 없어 DB 요청 시:
- 오버레이 표시 (`loadingOverlay.style.display = 'flex'`)
- `loadSample()` + `calculate()` 제거 (샘플 데이터 대신 빈 상태로 대기)

### 3. snapshot-restore 핸들러 수정 (~line 2908-2936)

DB 스냅샷 수신 시:
- 오버레이 숨김 (`loadingOverlay.style.display = 'none'`)

### 4. 타임아웃 폴백 (10초)

DB 응답이 없을 경우 오버레이를 숨기고 샘플 데이터 로드:

```javascript
window._dbLoadTimeout = setTimeout(() => {
  document.getElementById('loadingOverlay').style.display = 'none';
  if (!calculated) { loadSample(); calculate(); }
}, 10000);
```

snapshot-restore 수신 시 `clearTimeout(window._dbLoadTimeout)`.

| 파일 | 변경 |
|------|------|
| `public/cpm_network.html` | 로딩 오버레이 HTML/CSS, Init 수정, snapshot-restore에서 오버레이 해제, 타임아웃 폴백 |

