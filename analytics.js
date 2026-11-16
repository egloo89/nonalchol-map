// Vercel Web Analytics로만 전송한다. 집계 수치는 페이지에 그리지 않고,
// 공개 통계 페이지·대시보드 링크·집계 API 호출도 없다.
// 페이지뷰는 스크립트가 자동으로 보내고, 구매 클릭은 Pro의 커스텀 이벤트
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
