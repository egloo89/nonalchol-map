// 논알콜맵 서비스워커
// 홈 화면 추가(설치)를 가능하게 하는 용도만 한다. 아무것도 캐시하지 않으므로
// 새로 배포한 내용이 항상 바로 보인다. 페이지 이동 요청만 네트워크로 그대로 넘기고,
// 오프라인일 때는 간단한 안내 화면을 보여준다.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>논알콜맵</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;color:#111;text-align:center;padding:24px">
<div><div style="width:64px;height:64px;margin:0 auto 16px;border-radius:16px;background:linear-gradient(135deg,#2563eb,#10b981);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center">NON</div>
<p style="font-size:17px;font-weight:700;margin:0 0 6px">인터넷 연결이 끊겼어요</p>
<p style="font-size:14px;color:#6b7280;margin:0 0 20px">연결되면 다시 시도해 주세요.</p>
<button onclick="location.reload()" style="border:0;border-radius:12px;background:#2563eb;color:#fff;font-size:15px;font-weight:700;padding:12px 22px">다시 시도</button></div>
</body></html>`;

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    )
  );
});
