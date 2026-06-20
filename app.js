// =====================================================
// 논알콜 맥주 술집 맵 - 카카오맵 버전
// =====================================================

let map = null;
let markers = [];
let infoOverlays = [];
let places = [];
let currentInfoWindow = null;
let geocoderResult = null;
let currentPoiPlace = null;
let currentFilter = "전체";
let currentSearch = "";
let currentUser = null; // { uid, nickname }
let hasFitBounds = false; // 첫 로드 시 마커 범위 자동 조정 여부
let lastNonMarkerClick = 0; // NON 마커 클릭 시각 (맵 클릭 이벤트 중복 방지)

const BRANDS = [
  "논알콜 맥주 (종류 무관)",
  "논알콜 칵테일 (종류 무관)",
  "카스 제로 (0.0)",
  "하이네켄 제로 (0.0)",
  "하이트 제로 (0.00)",
  "클라우드 클리어 제로",
  "버드와이저 제로",
  "칼스버그 0.0",
  "코로나 선플로우 (Sunbrew)",
  "에르딩거 알코올프리",
  "파울라너 알코올프리",
  "바이엔슈테판 알코올프리",
  "칭따오 논알콜",
  "아사히 드라이 제로",
  "산 미구엘 0.0",
  "레페 브뤼 논알콜",
  "기타",
];

const BRAND_ICONS = {
  "전체": "🍺",
  "논알콜 맥주 (종류 무관)": "🍻",
  "논알콜 칵테일 (종류 무관)": "🍹",
  "하이트 제로 (0.00)": "🟠",
  "카스 제로 (0.0)": "🔵",
  "클라우드 클리어 제로": "🟡",
  "하이네켄 제로 (0.0)": "🟢",
  "버드와이저 제로": "🔴",
  "칼스버그 0.0": "🟣",
  "코로나 선플로우 (Sunbrew)": "🌟",
  "에르딩거 알코올프리": "⚪",
  "파울라너 알코올프리": "🔷",
  "바이엔슈테판 알코올프리": "🏔️",
  "칭따오 논알콜": "🟤",
  "아사히 드라이 제로": "🔶",
  "산 미구엘 0.0": "🌊",
  "레페 브뤼 논알콜": "🍶",
  "기타": "➕",
};

function initFirebase() {
  if (window.db) return true; // 이미 초기화됨 (중복 호출 방지)
  if (!window.firebase) {
    showMapMessage("Firebase 라이브러리를 불러오지 못했습니다.", true);
    return false;
  }
  try {
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    window.db = firebase.firestore();
    initAuth();
    return true;
  } catch (e) {
    showMapMessage("Firebase 설정 오류: firebase-config.js의 설정값을 확인해 주세요.", true);
    console.error(e);
    return false;
  }
}

// ─── 인증 ──────────────────────────────────────────

let authMode = "login"; // "login" | "signup"

function initAuth() {
  const auth = firebase.auth();

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const doc = await db.collection("users").doc(user.uid).get();
      if (doc.exists && doc.data().nickname) {
        currentUser = { uid: user.uid, nickname: doc.data().nickname };
        updateAuthUI(currentUser.nickname);
      } else {
        showNicknameModal(user);
      }
    } else {
      currentUser = null;
      updateAuthUI(null);
    }
  });

  document.getElementById("btn-login")?.addEventListener("click", openAuthModal);
  document.getElementById("btn-logout")?.addEventListener("click", () => firebase.auth().signOut());
  document.getElementById("auth-modal-close")?.addEventListener("click", closeAuthModal);
  document.getElementById("auth-modal-overlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeAuthModal();
  });

  // 구글 로그인
  document.getElementById("btn-google-login")?.addEventListener("click", async () => {
    setAuthError("");
    try {
      await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
      closeAuthModal();
    } catch (e) {
      setAuthError(getAuthErrorMsg(e.code));
    }
  });

  // 이메일 로그인/회원가입
  document.getElementById("btn-email-submit")?.addEventListener("click", handleEmailAuth);
  document.getElementById("auth-email")?.addEventListener("keydown", (e) => { if (e.key === "Enter") handleEmailAuth(); });
  document.getElementById("auth-password")?.addEventListener("keydown", (e) => { if (e.key === "Enter") handleEmailAuth(); });
  document.getElementById("auth-confirm")?.addEventListener("keydown", (e) => { if (e.key === "Enter") handleEmailAuth(); });

  // 모드 토글
  document.getElementById("btn-toggle-auth")?.addEventListener("click", () => {
    authMode = authMode === "login" ? "signup" : "login";
    updateAuthModalMode();
  });
}

function openAuthModal() {
  authMode = "login";
  updateAuthModalMode();
  setAuthError("");
  document.getElementById("auth-email").value = "";
  document.getElementById("auth-password").value = "";
  document.getElementById("auth-confirm").value = "";
  document.getElementById("auth-modal-overlay").classList.add("active");
}

function closeAuthModal() {
  document.getElementById("auth-modal-overlay").classList.remove("active");
}

function updateAuthModalMode() {
  const isSignup = authMode === "signup";
  document.getElementById("auth-modal-title").textContent = isSignup ? "회원가입" : "로그인";
  document.getElementById("auth-confirm-group").style.display = isSignup ? "block" : "none";
  document.getElementById("btn-email-submit").textContent = isSignup ? "회원가입" : "로그인";
  document.getElementById("btn-toggle-auth").textContent = isSignup ? "이미 계정이 있어요 → 로그인" : "계정이 없으신가요? → 회원가입";
  setAuthError("");
}

async function handleEmailAuth() {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const confirm = document.getElementById("auth-confirm").value;
  setAuthError("");

  if (!email || !password) { setAuthError("이메일과 비밀번호를 입력해 주세요."); return; }

  if (authMode === "signup") {
    if (password.length < 6) { setAuthError("비밀번호는 6자 이상이어야 합니다."); return; }
    if (password !== confirm) { setAuthError("비밀번호가 일치하지 않습니다."); return; }
    try {
      await firebase.auth().createUserWithEmailAndPassword(email, password);
      closeAuthModal();
    } catch (e) { setAuthError(getAuthErrorMsg(e.code)); }
  } else {
    try {
      await firebase.auth().signInWithEmailAndPassword(email, password);
      closeAuthModal();
    } catch (e) { setAuthError(getAuthErrorMsg(e.code)); }
  }
}

function setAuthError(msg) {
  const el = document.getElementById("auth-error");
  if (el) el.textContent = msg;
}

function getAuthErrorMsg(code) {
  const map = {
    "auth/email-already-in-use": "이미 사용 중인 이메일입니다.",
    "auth/wrong-password": "비밀번호가 틀렸습니다.",
    "auth/invalid-credential": "이메일 또는 비밀번호가 틀렸습니다.",
    "auth/user-not-found": "등록된 계정이 없습니다.",
    "auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
    "auth/invalid-email": "올바른 이메일 형식이 아닙니다.",
    "auth/too-many-requests": "잠시 후 다시 시도해 주세요.",
    "auth/popup-closed-by-user": "로그인이 취소되었습니다.",
  };
  return map[code] || "오류가 발생했습니다. 다시 시도해 주세요.";
}

function updateAuthUI(nickname) {
  const loggedOut = document.getElementById("auth-logged-out");
  const loggedIn = document.getElementById("auth-logged-in");
  const nicknameEl = document.getElementById("user-nickname");
  if (nickname) {
    loggedOut.style.display = "none";
    loggedIn.style.display = "flex";
    if (nicknameEl) nicknameEl.textContent = `👤 ${nickname}`;
  } else {
    loggedOut.style.display = "flex";
    loggedIn.style.display = "none";
  }
}

function showNicknameModal(user) {
  const overlay = document.getElementById("nickname-modal-overlay");
  if (!overlay) return;
  overlay.classList.add("active");
  document.getElementById("input-nickname").value = "";

  document.getElementById("btn-save-nickname").onclick = async () => {
    const nickname = document.getElementById("input-nickname").value.trim();
    if (nickname.length < 2) {
      showToast("닉네임을 2자 이상 입력해 주세요.", "error");
      return;
    }
    try {
      await db.collection("users").doc(user.uid).set({
        nickname,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      currentUser = { uid: user.uid, nickname };
      updateAuthUI(nickname);
      overlay.classList.remove("active");
      showToast(`${nickname}님 환영합니다!`, "success");
    } catch (e) {
      console.error(e);
      showToast("저장 중 오류가 발생했습니다.", "error");
    }
  };
}

// ─── 카카오맵 초기화 ───────────────────────────────

function initMap() {
  if (!window.kakao || !window.kakao.maps) {
    showMapMessage("카카오맵을 불러오지 못했습니다.", true);
    return;
  }

  const container = document.getElementById("map");
  map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(37.5665, 126.978),
    level: 5,
  });

  kakao.maps.event.addListener(map, "click", (mouseEvent) => {
    // NON 마커 클릭 직후(500ms) 발생한 맵 클릭은 무시 (모바일 touch 지연 대응)
    if (Date.now() - lastNonMarkerClick < 500) return;
    if (currentInfoWindow) {
      closeInfoWindow();
      return;
    }
    searchAndShowPoiInfo(mouseEvent.latLng);
  });

  hideMapMessage();

  // Firebase가 아직 준비 안 됐으면 먼저 초기화 (로드 순서 경쟁 방지)
  if (!window.db) initFirebase();
  loadPlaces();
}

function closeInfoWindow() {
  if (currentInfoWindow) {
    currentInfoWindow.setMap(null);
    currentInfoWindow = null;
  }
}

// ─── 기존 카카오맵 POI 클릭 정보 표시 ─────────────

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function searchAndShowPoiInfo(latlng) {
  if (!window.kakao?.maps?.services) return;

  // NON 등록된 가게 근처(80m 이내) 클릭은 POI 팝업 표시 안 함
  const clickLat = latlng.getLat();
  const clickLng = latlng.getLng();
  const nearbyNon = places.some((p) => {
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) return false;
    return haversineDistance(clickLat, clickLng, lat, lng) < 150;
  });
  if (nearbyNon) return;

  // 줌 레벨에 따른 검색 반경 조정 (정확도 향상)
  const levelRadii = { 1: 8, 2: 12, 3: 18, 4: 24, 5: 30, 6: 40, 7: 50 };
  const radius = levelRadii[map.getLevel()] ?? 30;

  const ps = new kakao.maps.services.Places();
  ps.categorySearch("FD6", (data, status) => {
    if (status === kakao.maps.services.Status.OK && data.length > 0) {
      showPoiInfoWindow(data[0], new kakao.maps.LatLng(data[0].y, data[0].x));
    }
  }, { location: latlng, radius, sort: kakao.maps.services.SortBy.DISTANCE, useMapBounds: false });
}

function showPoiInfoWindow(place, position) {
  // 비동기 검색 대기 중 NON 정보창이 열렸으면 POI 팝업 취소
  if (currentInfoWindow) return;
  currentPoiPlace = place;
  const infoEl = document.createElement("div");
  infoEl.innerHTML = buildPoiContent(place);

  infoEl.querySelector(".iw-close")?.addEventListener("click", (e) => {
    e.stopPropagation();
    kakao.maps.event.preventMap();
    closeInfoWindow();
  });
  infoEl.querySelector(".btn-register-nonalcohol")?.addEventListener("click", (e) => {
    e.stopPropagation();
    kakao.maps.event.preventMap();
    closeInfoWindow();
    openModalWithPlaceData(place);
  });

  const overlay = new kakao.maps.CustomOverlay({
    position,
    content: infoEl,
    map,
    yAnchor: 1.15,
    zIndex: 5,
  });
  currentInfoWindow = overlay;
}

function buildPoiContent(place) {
  const category = place.category_name
    ? escapeHtml(place.category_name.split(" > ").pop())
    : "";
  const address = escapeHtml(place.road_address_name || place.address_name || "");
  const name = escapeHtml(place.place_name);
  const phone = place.phone ? escapeHtml(place.phone) : "";
  const url = place.place_url ? escapeHtml(place.place_url) : "";

  return `
    <div class="info-window poi-info-window">
      <button class="iw-close">✕</button>
      <div class="iw-name">${name}</div>
      ${category ? `<div class="iw-category">${category}</div>` : ""}
      <div class="iw-address">📍 ${address}</div>
      ${phone ? `<div class="iw-meta">📞 ${phone}</div>` : ""}
      ${url ? `<div class="iw-meta"><a href="${url}" target="_blank" rel="noopener">카카오맵에서 보기 →</a></div>` : ""}
      <button class="btn-register-nonalcohol">🍺 논알콜 등록하기</button>
    </div>
  `;
}

function openModalWithPlaceData(place) {
  openModal();
  document.getElementById("input-name").value = place.place_name || "";
  document.getElementById("input-address").value = place.road_address_name || place.address_name || "";
  if (place.phone) document.getElementById("input-phone").value = place.phone;
  geocoderResult = { lat: parseFloat(place.y), lng: parseFloat(place.x) };
  updateCoordsDisplay(geocoderResult.lat, geocoderResult.lng);
}

// ─── Firestore: 가게 불러오기 ──────────────────────

let prevPlaceCount = -1;

function loadPlaces() {
  db.collection("places")
    .onSnapshot((snapshot) => {
      places = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      console.log("[loadPlaces] 가게 수:", places.length, places.map(p => `${p.name}(${p.lat},${p.lng})`));

      // 지도가 열린 상태에서 새 가게가 승인/추가되면 그 위치로 이동하도록 범위 재조정
      if (prevPlaceCount !== -1 && places.length > prevPlaceCount) {
        hasFitBounds = false;
        const newest = places[0]; // 가장 최근 추가된 가게
        if (newest && Number(newest.lat) && Number(newest.lng)) {
          showToast(`새 가게 '${newest.name}'가 지도에 추가됐어요!`, "success");
        }
      }
      prevPlaceCount = places.length;

      updateCount(places.length);
      applyFilters();
    }, (err) => {
      console.error("[loadPlaces] Firestore 오류 (보안 규칙 확인 필요):", err.code, err.message);
      showToast("데이터를 불러오는 중 오류가 발생했습니다. (F12 콘솔 확인)", "error");
    });
}

// ─── Firestore: 가게 추가 ──────────────────────────

async function addPlace(data) {
  await db.collection("places").add({
    ...data,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// ─── 마커 렌더링 (카카오 CustomOverlay) ──────────

function clearMarkers() {
  markers.forEach((m) => m.setMap(null));
  infoOverlays.forEach((o) => o.setMap(null));
  markers = [];
  infoOverlays = [];
  currentInfoWindow = null;
}

function renderMarkers(filtered) {
  clearMarkers();
  const list = filtered ?? places;

  const bounds = new kakao.maps.LatLngBounds();
  let validCount = 0;
  let lastPos = null;

  list.forEach((place) => {
    // 좌표가 문자열로 저장된 경우도 대비해 숫자로 변환
    const lat = Number(place.lat);
    const lng = Number(place.lng);
    if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) {
      console.warn("[renderMarkers] 좌표 없음/이상 → 건너뜀:", place.name, place.lat, place.lng);
      return;
    }

    const position = new kakao.maps.LatLng(lat, lng);
    bounds.extend(position);
    lastPos = position;
    validCount++;

    // NON 핀 마커 (CustomOverlay)
    const markerEl = document.createElement("div");
    markerEl.innerHTML = `
      <div class="non-marker">
        <div class="non-pin">NON</div>
        <div class="non-tail"></div>
      </div>
    `;

    const marker = new kakao.maps.CustomOverlay({
      position,
      content: markerEl,
      map,
      yAnchor: 1,
      zIndex: 3,
    });

    // 정보창 (CustomOverlay)
    const infoContent = buildInfoWindowContent(place);
    const infoEl = document.createElement("div");
    infoEl.innerHTML = infoContent;

    const infoOverlay = new kakao.maps.CustomOverlay({
      position,
      content: infoEl,
      map: null,
      yAnchor: 1.15,
      zIndex: 5,
    });

    // 마커 터치/클릭 (touchstart로 모바일에서 더 빨리 감지)
    const openNonInfo = (e) => {
      e.stopPropagation();
      kakao.maps.event.preventMap();
      lastNonMarkerClick = Date.now();
      closeInfoWindow();
      infoOverlay.setMap(map);
      currentInfoWindow = infoOverlay;
      highlightCard(place.id);
      map.panTo(position);
    };
    markerEl.addEventListener("touchstart", (e) => {
      lastNonMarkerClick = Date.now(); // 클릭 핸들러보다 먼저 타임스탬프 기록
    }, { passive: true });
    markerEl.addEventListener("click", openNonInfo);

    // 정보창 내 네이버맵 링크 클릭 (카카오 이벤트 차단 후 직접 새 탭 이동)
    infoEl.querySelector(".btn-naver-map")?.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      kakao.maps.event.preventMap();
      window.open(e.currentTarget.href, "_blank", "noopener,noreferrer");
    });

    markers.push(marker);
    infoOverlays.push(infoOverlay);
  });

  console.log(`[renderMarkers] 표시된 마커 ${validCount}개 / 전체 ${list.length}개`);

  // 첫 로드 시 모든 마커가 보이도록 지도 범위 자동 조정
  if (validCount > 0 && !hasFitBounds) {
    // 카카오맵 컨테이너 크기 계산 타이밍 보정 후 범위 적용
    setTimeout(() => {
      map.relayout();
      if (validCount === 1 && lastPos) {
        map.setCenter(lastPos);
        map.setLevel(4);
      } else {
        map.setBounds(bounds);
      }
    }, 200);
    hasFitBounds = true;
  }
}

function buildInfoWindowContent(place) {
  const brandsHtml = (place.brands || [])
    .map((b) => `<span class="brand-tag">${escapeHtml(b)}</span>`)
    .join("");

  const naverUrl = "https://map.naver.com/p/search/" + encodeURIComponent(place.name || "");

  return `
    <div class="info-window">
      <div class="iw-name">${escapeHtml(place.name)}</div>
      <div class="iw-address">📍 ${escapeHtml(place.address)}</div>
      ${brandsHtml ? `<div class="iw-brands">${brandsHtml}</div>` : ""}
      ${place.description ? `<div class="iw-desc">${escapeHtml(place.description)}</div>` : ""}
      ${place.phone ? `<div class="iw-meta">📞 ${escapeHtml(place.phone)}</div>` : ""}
      ${place.hours ? `<div class="iw-meta">🕐 ${escapeHtml(place.hours)}</div>` : ""}
      <div class="iw-meta" style="margin-top:6px">추가: ${escapeHtml(place.addedBy || "익명")}</div>
      <a href="${naverUrl}" target="_blank" rel="noopener" class="btn-naver-map">네이버맵 바로가기</a>
    </div>
  `;
}

// ─── 사이드바 렌더링 ───────────────────────────────

function renderSidebar(list) {
  const container = document.getElementById("place-list");

  if (list.length === 0) {
    const isFiltering = currentFilter !== "전체" || currentSearch;
    container.innerHTML = isFiltering
      ? `
      <div id="empty-state">
        <div class="icon">🔍</div>
        <p>조건에 맞는 가게가 없어요.<br>다른 브랜드를 선택하거나<br>필터를 초기화해 보세요.</p>
      </div>
      `
      : `
      <div id="empty-state">
        <div class="icon">🗺️</div>
        <p>아직 등록된 가게가 없어요.<br>논알콜 맥주를 파는 술집을<br>첫 번째로 추가해 보세요!</p>
      </div>
      `;
    return;
  }

  container.innerHTML = list
    .map((p) => `
      <div class="place-card" data-id="${p.id}" onclick="focusPlace('${p.id}')">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="address">📍 ${escapeHtml(p.address)}</div>
        <div class="brands">
          ${(p.brands || []).map((b) => `<span class="brand-tag">${escapeHtml(b)}</span>`).join("")}
        </div>
        ${p.description ? `<div class="meta">${escapeHtml(p.description.slice(0, 60))}${p.description.length > 60 ? "..." : ""}</div>` : ""}
      </div>
    `)
    .join("");
}

function highlightCard(id) {
  document.querySelectorAll(".place-card").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === id);
  });
  const activeCard = document.querySelector(`.place-card[data-id="${id}"]`);
  if (activeCard) activeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

window.focusPlace = function (id) {
  const place = places.find((p) => p.id === id);
  if (!place || !place.lat || !place.lng) return;

  highlightCard(id);
  const position = new kakao.maps.LatLng(place.lat, place.lng);
  map.panTo(position);
  map.setLevel(3);

  // 해당 마커의 정보창 열기
  const idx = (places.filter((p) => p.lat && p.lng)).findIndex((p) => p.id === id);
  if (infoOverlays[idx]) {
    closeInfoWindow();
    infoOverlays[idx].setMap(map);
    currentInfoWindow = infoOverlays[idx];
  }
};

function updateCount(n) {
  const el = document.getElementById("place-count");
  if (el) el.textContent = `${n}개 가게`;
}

// ─── 브랜드 필터 ───────────────────────────────────


const FILTER_PREVIEW = 5; // 전체 + 논알콜 맥주, 논알콜 칵테일, 카스 제로, 하이네켄 제로

function initBrandFilter() {
  const container = document.getElementById("brand-filter");
  if (!container) return;
  const chips = ["전체", ...BRANDS];
  let expanded = false;
  const hiddenCount = chips.length - FILTER_PREVIEW;

  container.innerHTML =
    chips.map((b, i) => `
      <button type="button"
        class="filter-chip${i === 0 ? " active chip-all" : ""}${i >= FILTER_PREVIEW ? " chip-collapsed" : ""}"
        data-brand="${escapeHtml(b)}">
        <span class="chip-icon">${BRAND_ICONS[b] || "🍺"}</span>
        <span class="chip-label">${escapeHtml(b)}</span>
      </button>`).join("") +
    `<button type="button" id="filter-toggle" class="filter-toggle">
       <span id="filter-toggle-text">+ ${hiddenCount}개 더 보기</span>
     </button>`;

  container.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      container.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.dataset.brand;
      applyFilters();
    });
  });

  document.getElementById("filter-toggle").addEventListener("click", () => {
    expanded = !expanded;
    container.querySelectorAll(".chip-collapsed").forEach((c) => {
      c.style.display = expanded ? "" : "none";
    });
    document.getElementById("filter-toggle-text").textContent =
      expanded ? "▲ 접기" : `+ ${hiddenCount}개 더 보기`;
  });

  // 초기 숨김
  container.querySelectorAll(".chip-collapsed").forEach((c) => { c.style.display = "none"; });
}

function getFilteredPlaces() {
  return places.filter((p) => {
    const matchesBrand = currentFilter === "전체" || (p.brands || []).includes(currentFilter);
    const q = currentSearch;
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      (p.brands || []).some((b) => b.toLowerCase().includes(q));
    return matchesBrand && matchesSearch;
  });
}

function applyFilters() {
  const filtered = getFilteredPlaces();
  if (map) renderMarkers(filtered);
  renderSidebar(filtered);
  updateFilterStatus(filtered.length);
}

// 적용 중인 필터를 사이드바 상단에 표시
function updateFilterStatus(shownCount) {
  const el = document.getElementById("filter-status");
  if (!el) return;

  const hasFilter = currentFilter !== "전체" || currentSearch;
  if (!hasFilter) {
    el.style.display = "none";
    updateCount(places.length);
    return;
  }

  const parts = [];
  if (currentFilter !== "전체") parts.push(`<span class="fs-tag">🏷️ ${escapeHtml(currentFilter)}</span>`);
  if (currentSearch) parts.push(`<span class="fs-tag">🔍 "${escapeHtml(currentSearch)}"</span>`);

  el.innerHTML = `
    <div class="fs-info">${parts.join("")}<span class="fs-count">${shownCount}개 표시</span></div>
    <button type="button" id="btn-clear-filter">초기화 ✕</button>
  `;
  el.style.display = "flex";
  document.getElementById("btn-clear-filter").addEventListener("click", clearFilters);
  updateCount(shownCount);
}

function clearFilters() {
  currentFilter = "전체";
  currentSearch = "";
  document.getElementById("search-input").value = "";
  document.querySelectorAll("#brand-filter .filter-chip").forEach((c) => {
    c.classList.toggle("active", c.dataset.brand === "전체");
  });

  applyFilters();
}

// ─── 검색 ──────────────────────────────────────────

document.getElementById("search-input").addEventListener("input", function () {
  currentSearch = this.value.trim().toLowerCase();
  applyFilters();
});

// ─── 가게 추가 모달 ────────────────────────────────

document.getElementById("btn-add-place").addEventListener("click", openModal);

function openModal() {
  document.getElementById("modal-overlay").classList.add("active");
  document.getElementById("add-form").reset();
  geocoderResult = null;
  updateCoordsDisplay(null, null);
  document.querySelectorAll(".brand-checkbox").forEach((el) => el.classList.remove("checked"));
  document.getElementById("brand-other-input").style.display = "none";
  // 로그인된 경우 닉네임 자동 입력
  if (currentUser?.nickname) {
    document.getElementById("input-added-by").value = currentUser.nickname;
  }
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("active");
}

document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("btn-cancel").addEventListener("click", closeModal);
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});

document.querySelectorAll(".brand-checkbox").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    el.classList.toggle("checked");
    if (el.dataset.value === "기타") {
      document.getElementById("brand-other-input").style.display =
        el.classList.contains("checked") ? "block" : "none";
    }
  });
});

// ─── 주소 → 좌표 변환 (카카오 Geocoder) ──────────

document.getElementById("btn-search-address").addEventListener("click", () => {
  const address = document.getElementById("input-address").value.trim();
  if (!address) {
    showToast("주소를 먼저 입력해 주세요.");
    return;
  }

  const btn = document.getElementById("btn-search-address");
  btn.textContent = "검색 중...";
  btn.disabled = true;

  const geocoder = new kakao.maps.services.Geocoder();
  geocoder.addressSearch(address, (result, status) => {
    btn.textContent = "주소 확인";
    btn.disabled = false;

    if (status === kakao.maps.services.Status.OK && result.length > 0) {
      geocoderResult = {
        lat: parseFloat(result[0].y),
        lng: parseFloat(result[0].x),
      };
      updateCoordsDisplay(geocoderResult.lat, geocoderResult.lng);
      showToast("주소 확인 완료!", "success");
    } else {
      showToast("주소를 찾을 수 없습니다. 더 구체적으로 입력해 주세요.", "error");
      geocoderResult = null;
      updateCoordsDisplay(null, null);
    }
  });
});

function updateCoordsDisplay(lat, lng) {
  const el = document.getElementById("coords-display");
  if (lat && lng) {
    el.innerHTML = `위치 확인됨 → <span>위도 ${lat.toFixed(5)}, 경도 ${lng.toFixed(5)}</span>`;
    el.style.borderColor = "#10b981";
  } else {
    el.innerHTML = "주소를 입력하고 <b>주소 확인</b> 버튼을 눌러주세요.";
    el.style.borderColor = "";
  }
}

// ─── 폼 제출 ───────────────────────────────────────

document.getElementById("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("input-name").value.trim();
  const address = document.getElementById("input-address").value.trim();

  if (!name || !address) {
    showToast("가게 이름과 주소는 필수입니다.", "error");
    return;
  }
  if (!geocoderResult) {
    showToast("주소 확인 버튼을 눌러 위치를 확인해 주세요.", "error");
    return;
  }

  const brands = [];
  document.querySelectorAll(".brand-checkbox.checked").forEach((el) => {
    const val = el.dataset.value;
    if (val === "기타") {
      const custom = document.getElementById("input-other-brand").value.trim();
      if (custom) brands.push(custom);
    } else {
      brands.push(val);
    }
  });

  if (brands.length === 0) {
    showToast("논알콜 맥주 종류를 1개 이상 선택해 주세요.", "error");
    return;
  }

  const btn = document.getElementById("btn-submit");
  btn.textContent = "등록 중...";
  btn.disabled = true;

  try {
    await addPlace({
      name,
      address,
      lat: geocoderResult.lat,
      lng: geocoderResult.lng,
      brands,
      description: document.getElementById("input-description").value.trim(),
      phone: document.getElementById("input-phone").value.trim(),
      hours: document.getElementById("input-hours").value.trim(),
      addedBy: document.getElementById("input-added-by").value.trim() || "익명",
    });

    closeModal();
    showToast(`'${name}' 가게가 등록되었습니다!`, "success");
    map.panTo(new kakao.maps.LatLng(geocoderResult.lat, geocoderResult.lng));
    map.setLevel(3);
  } catch (err) {
    console.error(err);
    showToast("등록 중 오류가 발생했습니다. 다시 시도해 주세요.", "error");
  } finally {
    btn.textContent = "가게 등록하기";
    btn.disabled = false;
  }
});

// ─── 가게 제보 ─────────────────────────────────────

let reportGeocoderResult = null;

function initReportModal() {
  const overlay = document.getElementById("report-modal-overlay");
  if (!overlay) return;

  // 브랜드 체크박스 동적 생성
  document.getElementById("report-brands").innerHTML = BRANDS
    .map((b) => `
      <label class="brand-checkbox" data-value="${escapeHtml(b)}">
        <input type="checkbox" /><span class="cb-icon">${BRAND_ICONS[b] || "🍺"}</span> ${escapeHtml(b)}
      </label>
    `)
    .join("");

  document.querySelectorAll("#report-brands .brand-checkbox").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      el.classList.toggle("checked");
      if (el.dataset.value === "기타") {
        document.getElementById("report-other-input").style.display =
          el.classList.contains("checked") ? "block" : "none";
      }
    });
  });

  document.getElementById("btn-report-place").addEventListener("click", openReportModal);
  document.getElementById("btn-report-place-mobile")?.addEventListener("click", openReportModal);
  document.getElementById("report-modal-close").addEventListener("click", closeReportModal);
  document.getElementById("btn-report-cancel").addEventListener("click", closeReportModal);
  // 배경 클릭으로는 닫히지 않음 (X 버튼만으로 닫기)

  const REPORT_PAGE_SIZE = 5;
  let reportResults = [];
  let reportPage = 1;

  // 검색 실행 (버튼 클릭 / 엔터 공통)
  function runReportSearch() {
    const raw = document.getElementById("report-search-input").value.trim();
    if (!raw) { showToast("가게 이름이나 주소를 입력해 주세요."); return; }

    const btn = document.getElementById("btn-report-address");
    btn.textContent = "검색 중...";
    btn.disabled = true;
    const resetBtn = () => { btn.textContent = "검색"; btn.disabled = false; };

    if (!window.kakao?.maps?.services) {
      resetBtn();
      showToast("카카오맵 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.", "error");
      return;
    }

    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(raw, (data, status) => {
      resetBtn();
      if (status !== kakao.maps.services.Status.OK || !data.length) {
        showToast("검색 결과가 없습니다. 다른 키워드나 주소로 시도해 보세요.", "error");
        return;
      }
      reportResults = sortByRegion(data);
      reportPage = 1;
      renderReportResults();
    }, { size: 15 });
  }

  // 서울·경기·인천 우선 정렬
  function sortByRegion(data) {
    const PRIORITY = ["서울", "경기", "인천"];
    const regionRank = (p) => {
      const addr = p.road_address_name || p.address_name || "";
      const idx = PRIORITY.findIndex((r) => addr.startsWith(r));
      return idx === -1 ? PRIORITY.length : idx;
    };
    return data
      .map((p, i) => ({ p, i, rank: regionRank(p) }))
      .sort((a, b) => a.rank - b.rank || a.i - b.i)
      .map((x) => x.p);
  }

  function renderReportResults() {
    const resultsEl = document.getElementById("report-place-results");
    document.getElementById("report-selected-card").style.display = "none";
    resultsEl.style.display = "block";

    const total = reportResults.length;
    const totalPages = Math.ceil(total / REPORT_PAGE_SIZE);
    const start = (reportPage - 1) * REPORT_PAGE_SIZE;
    const pageItems = reportResults.slice(start, start + REPORT_PAGE_SIZE);

    const pager = totalPages > 1
      ? `<div class="prl-pager">${Array.from({ length: totalPages }, (_, i) =>
          `<button type="button" class="prl-page ${i + 1 === reportPage ? "active" : ""}" data-page="${i + 1}">${i + 1}</button>`
        ).join("")}</div>`
      : "";

    resultsEl.innerHTML = `
      <div class="prl-title">가게를 선택해 주세요 (총 ${total}개)</div>
      ${pageItems.map((p, i) => `
        <div class="prl-item" data-idx="${start + i}">
          <div class="prl-name">${escapeHtml(p.place_name)}</div>
          <div class="prl-addr">${escapeHtml(p.road_address_name || p.address_name)}</div>
          ${p.category_name ? `<div class="prl-cat">${escapeHtml(p.category_name.split(" > ").pop())}</div>` : ""}
          ${p.phone ? `<div class="prl-phone">📞 ${escapeHtml(p.phone)}</div>` : ""}
        </div>
      `).join("")}
      ${pager}
    `;
    resultsEl.querySelectorAll(".prl-item").forEach((item) => {
      item.addEventListener("click", () => {
        selectReportPlace(reportResults[Number(item.dataset.idx)]);
        resultsEl.style.display = "none";
      });
    });
    resultsEl.querySelectorAll(".prl-page").forEach((btn) => {
      btn.addEventListener("click", () => {
        reportPage = Number(btn.dataset.page);
        renderReportResults();
      });
    });
  }

  // 한마디 글자 수 카운터
  const commentEl = document.getElementById("report-comment");
  const counterEl = document.getElementById("comment-counter");
  if (commentEl && counterEl) {
    commentEl.addEventListener("input", () => {
      const len = commentEl.value.length;
      counterEl.textContent = `${len}/300`;
      counterEl.className = "char-counter" + (len >= 300 ? " at-limit" : len >= 250 ? " near-limit" : "");
    });
  }

  // 검색 버튼 클릭
  document.getElementById("btn-report-address").addEventListener("click", runReportSearch);
  // 입력칸에서 엔터로도 검색 (form submit 방지)
  document.getElementById("report-search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runReportSearch();
    }
  });

  function selectReportPlace(place) {
    reportGeocoderResult = { lat: parseFloat(place.y), lng: parseFloat(place.x) };
    const addr = place.road_address_name || place.address_name || "";
    document.getElementById("report-name").value = place.place_name || "";
    document.getElementById("report-address").value = addr;

    document.getElementById("spc-name").textContent = place.place_name || "";
    document.getElementById("spc-addr").textContent = addr;
    document.getElementById("spc-coords").textContent =
      `위도 ${reportGeocoderResult.lat.toFixed(5)}, 경도 ${reportGeocoderResult.lng.toFixed(5)}`;
    if (place.phone) document.getElementById("spc-coords").textContent += `  📞 ${place.phone}`;

    // 네이버 맵 바로가기 링크 설정
    const naverLink = document.getElementById("spc-naver-link");
    if (naverLink) {
      const q = encodeURIComponent((place.place_name || "") + " " + addr);
      naverLink.href = "https://map.naver.com/p/search/" + encodeURIComponent(place.place_name || "");
    }

    document.getElementById("report-selected-card").style.display = "block";
    showToast(`'${place.place_name}' 선택됐습니다!`, "success");
  }

  document.getElementById("btn-change-place")?.addEventListener("click", () => {
    document.getElementById("report-selected-card").style.display = "none";
    document.getElementById("report-name").value = "";
    document.getElementById("report-address").value = "";
    reportGeocoderResult = null;
    document.getElementById("report-search-input").focus();
  });

  // 제보 제출
  document.getElementById("report-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("report-name").value.trim();
    const address = document.getElementById("report-address").value.trim();

    if (!name || !address || !reportGeocoderResult) {
      showToast("가게를 검색하고 목록에서 선택해 주세요.", "error");
      return;
    }

    const brands = [];
    document.querySelectorAll("#report-brands .brand-checkbox.checked").forEach((el) => {
      const val = el.dataset.value;
      if (val === "기타") {
        const custom = document.getElementById("report-other-brand").value.trim();
        if (custom) brands.push(custom);
      } else {
        brands.push(val);
      }
    });

    if (brands.length === 0) {
      showToast("논알콜 종류를 1개 이상 선택해 주세요.", "error");
      return;
    }

    const btn = document.getElementById("btn-report-submit");
    btn.textContent = "제보 중...";
    btn.disabled = true;

    try {
      await db.collection("reports").add({
        name,
        address,
        lat: reportGeocoderResult.lat,
        lng: reportGeocoderResult.lng,
        brands,
        comment: document.getElementById("report-comment").value.trim(),
        reportedBy: currentUser?.nickname || "익명",
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      closeReportModal();
      showToast("제보 완료! 관리자 확인 후 지도에 표시됩니다. 🙏", "success");
    } catch (err) {
      console.error(err);
      showToast("제보 중 오류가 발생했습니다. 다시 시도해 주세요.", "error");
    } finally {
      btn.textContent = "제보하기";
      btn.disabled = false;
    }
  });
}

function openReportModal() {
  document.getElementById("report-form").reset();
  document.getElementById("report-search-input").value = "";
  reportGeocoderResult = null;
  const ctr = document.getElementById("comment-counter");
  if (ctr) { ctr.textContent = "0/300"; ctr.className = "char-counter"; }
  document.getElementById("report-place-results").style.display = "none";
  document.getElementById("report-selected-card").style.display = "none";
  document.getElementById("report-name").value = "";
  document.getElementById("report-address").value = "";
  document.querySelectorAll("#report-brands .brand-checkbox").forEach((c) => c.classList.remove("checked"));
  document.getElementById("report-other-input").style.display = "none";
  document.getElementById("report-modal-overlay").classList.add("active");
}

function closeReportModal() {
  document.getElementById("report-modal-overlay").classList.remove("active");
}

// ─── Toast ─────────────────────────────────────────

function showToast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = type;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

// ─── 지도 메시지 ───────────────────────────────────

function showMapMessage(msg, isError = false) {
  const el = document.getElementById("map-message");
  el.innerHTML = `<span>${isError ? "⚠️" : "⏳"}</span><span>${msg}</span>`;
  el.classList.remove("hidden");
}

function hideMapMessage() {
  document.getElementById("map-message").classList.add("hidden");
}

// ─── 유틸 ─────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── 앱 시작 ───────────────────────────────────────

window.onload = function () {
  initFirebase();
  initBrandFilter(); // 지도 로드와 무관하게 필터는 항상 표시
  initReportModal();
  // initMap은 카카오맵 SDK 로드 후 자동 호출됨 (index.html 참고)
};
