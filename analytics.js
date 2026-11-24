// 1) Vercel Web Analytics: 페이지뷰는 스크립트가 자동으로 보내고, 구매 클릭은 Pro의 커스텀 이벤트
// 2) 일자별 방문자 수: 아래 countDailyVisit 가 Firestore 에 세고, 관리자 페이지(admin.html)에서만 보여준다.
//
// 구매 클릭은 Pro의 커스텀 이벤트
// (속성 2개: 상품명, utm_source)로 보낸다. 링크 이동은 막거나 기다리지 않는다.
window.va = window.va || function () {
  (window.vaq = window.vaq || []).push(arguments);
};

var UTM_SOURCE_KEY = "nonalchol_utm_source";

function readUtmSource() {
  try {
    var fromUrl = new URLSearchParams(location.search).get("utm_source");
    if (fromUrl) {
      sessionStorage.setItem(UTM_SOURCE_KEY, fromUrl.slice(0, 255));
      return fromUrl;
    }
    return sessionStorage.getItem(UTM_SOURCE_KEY) || "";
  } catch (e) {
    return "";
  }
}

readUtmSource();

window.trackCoupangClick = function (productName) {
  var product = String(productName || "").trim().slice(0, 255);
  var source = String(readUtmSource() || "(none)").slice(0, 255);
  try {
    window.va("event", {
      name: "coupang_click",
      data: { product: product, utm_source: source },
    });
  } catch (e) {}
};

// ─── 일자별 방문자 수 (관리자 페이지 통계용) ─────────────────
// Firestore stats_daily/{YYYY-MM-DD(한국 시간)} 문서의 숫자를 1씩 올린다.
//  - pageviews: 페이지를 열 때마다 +1
//  - visitors : 같은 브라우저는 하루에 한 번만 +1
// 관리자 페이지와, 관리자 페이지를 열어 본 적이 있는 브라우저는 세지 않는다.
(function countDailyVisit() {
  var PROJECT = "non-alchol-map";
  var API_KEY = "AIzaSyDG15N1TK5mSKTgYsJz5huZjQWlQDbWDjM";
  var VISIT_DAY_KEY = "nonmap-visit-day";
  var ADMIN_FLAG_KEY = "nonmap-is-admin";

  try {
    if (/\/admin(\.html)?$/.test(location.pathname)) {
      localStorage.setItem(ADMIN_FLAG_KEY, "1");
      return;
    }
    if (localStorage.getItem(ADMIN_FLAG_KEY) === "1") return;
    if (location.protocol !== "https:") return; // 로컬 테스트는 세지 않는다
    if (/bot|crawl|spider|slurp|headless|lighthouse/i.test(navigator.userAgent)) return;
  } catch (e) { return; }

  var day;
  try {
    day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch (e) { return; }

  var isNewVisitor = true;
  try {
    isNewVisitor = localStorage.getItem(VISIT_DAY_KEY) !== day;
    localStorage.setItem(VISIT_DAY_KEY, day);
  } catch (e) {}

  var base = "projects/" + PROJECT + "/databases/(default)/documents";
  var transforms = [{ fieldPath: "pageviews", increment: { integerValue: "1" } }];
  if (isNewVisitor) transforms.push({ fieldPath: "visitors", increment: { integerValue: "1" } });

  try {
    fetch("https://firestore.googleapis.com/v1/" + base + ":commit?key=" + API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        writes: [{ transform: { document: base + "/stats_daily/" + day, fieldTransforms: transforms } }],
      }),
    }).catch(function () {});
  } catch (e) {}
})();
