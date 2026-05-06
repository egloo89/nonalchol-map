// =====================================================
// 논알콜 맥주 술집 맵 - 메인 앱
// =====================================================

let map = null;
let markers = [];
let places = [];
let currentInfoWindow = null;
let geocoderResult = null;

// ─── Firebase 초기화 ───────────────────────────────

function initFirebase() {
  if (!window.firebase) {
    showMapMessage("Firebase 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.", true);
    return false;
  }
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    window.db = firebase.firestore();
    return true;
  } catch (e) {
    showMapMessage("Firebase 설정 오류: firebase-config.js의 설정값을 확인해 주세요.", true);
    console.error(e);
    return false;
  }
}

// ─── 네이버 맵 초기화 ──────────────────────────────

function initMap() {
  if (!window.naver || !window.naver.maps) {
    showMapMessage("네이버 맵을 불러오지 못했습니다. Client ID를 확인해 주세요.", true);
    return;
  }

  map = new naver.maps.Map("map", {
    center: new naver.maps.LatLng(37.5665, 126.978),
    zoom: 13,
    mapTypeControl: false,
    scaleControl: false,
  });

  // 지도 클릭 시 열린 info window 닫기
  naver.maps.Event.addListener(map, "click", () => {
    if (currentInfoWindow) currentInfoWindow.close();
  });

  hideMapMessage();
  loadPlaces();
}

// ─── Firestore: 가게 불러오기 ──────────────────────

function loadPlaces() {
  db.collection("places")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      places = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderMarkers();
      renderSidebar(places);
      updateCount(places.length);
    }, (err) => {
      console.error("데이터 불러오기 실패:", err);
      showToast("데이터를 불러오는 중 오류가 발생했습니다.", "error");
    });
}

// ─── Firestore: 가게 추가 ──────────────────────────

async function addPlace(data) {
  await db.collection("places").add({
    ...data,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// ─── 마커 렌더링 ───────────────────────────────────

function clearMarkers() {
  markers.forEach((m) => m.setMap(null));
  markers = [];
}

function renderMarkers(filtered) {
  clearMarkers();
  const list = filtered ?? places;

  list.forEach((place) => {
    if (!place.lat || !place.lng) return;

    const markerEl = document.createElement("div");
    markerEl.className = "custom-marker";
    markerEl.innerHTML = `
      <div style="
        background: #2563eb;
        color: white;
        border-radius: 50% 50% 50% 0;
        width: 36px; height: 36px;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px;
        box-shadow: 0 2px 8px rgba(37,99,235,0.5);
        transform: rotate(-45deg);
        border: 2px solid white;
      ">
        <span style="transform: rotate(45deg);">🍺</span>
      </div>
    `;

    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(place.lat, place.lng),
      map: map,
      icon: {
        content: markerEl,
        anchor: new naver.maps.Point(18, 36),
      },
    });

    const infoContent = buildInfoWindowContent(place);
    const infoWindow = new naver.maps.InfoWindow({
      content: infoContent,
      borderWidth: 0,
      disableAnchor: false,
      backgroundColor: "transparent",
      pixelOffset: new naver.maps.Point(0, -10),
    });

    naver.maps.Event.addListener(marker, "click", () => {
      if (currentInfoWindow) currentInfoWindow.close();
      infoWindow.open(map, marker);
      currentInfoWindow = infoWindow;
      highlightCard(place.id);
      map.panTo(new naver.maps.LatLng(place.lat, place.lng));
    });

    markers.push(marker);
  });
}

function buildInfoWindowContent(place) {
  const brandsHtml = (place.brands || [])
    .map((b) => `<span class="brand-tag">${b}</span>`)
    .join("");

  return `
    <div class="info-window">
      <div class="iw-name">${escapeHtml(place.name)}</div>
      <div class="iw-address">📍 ${escapeHtml(place.address)}</div>
      ${brandsHtml ? `<div class="iw-brands">${brandsHtml}</div>` : ""}
      ${place.description ? `<div class="iw-desc">${escapeHtml(place.description)}</div>` : ""}
      ${place.phone ? `<div class="iw-meta">📞 ${escapeHtml(place.phone)}</div>` : ""}
      ${place.hours ? `<div class="iw-meta">🕐 ${escapeHtml(place.hours)}</div>` : ""}
      <div class="iw-meta" style="margin-top:6px">
        추가: ${place.addedBy ? escapeHtml(place.addedBy) : "익명"}
      </div>
    </div>
  `;
}

// ─── 사이드바 렌더링 ───────────────────────────────

function renderSidebar(list) {
  const container = document.getElementById("place-list");

  if (list.length === 0) {
    container.innerHTML = `
      <div id="empty-state">
        <div class="icon">🗺️</div>
        <p>아직 등록된 가게가 없어요.<br>논알콜 맥주를 파는 술집을<br>첫 번째로 추가해 보세요!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list
    .map(
      (p) => `
    <div class="place-card" data-id="${p.id}" onclick="focusPlace('${p.id}')">
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="address">📍 ${escapeHtml(p.address)}</div>
      <div class="brands">
        ${(p.brands || []).map((b) => `<span class="brand-tag">${b}</span>`).join("")}
      </div>
      ${p.description ? `<div class="meta">${escapeHtml(p.description.slice(0, 60))}${p.description.length > 60 ? "..." : ""}</div>` : ""}
    </div>
  `
    )
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
  map.panTo(new naver.maps.LatLng(place.lat, place.lng));
  map.setZoom(16);

  const markerIndex = places.filter((p) => p.lat && p.lng).findIndex((p) => p.id === id);
  if (markers[markerIndex]) {
    naver.maps.Event.trigger(markers[markerIndex], "click");
  }
};

function updateCount(n) {
  const el = document.getElementById("place-count");
  if (el) el.textContent = `${n}개 가게`;
}

// ─── 검색 ──────────────────────────────────────────

document.getElementById("search-input").addEventListener("input", function () {
  const q = this.value.trim().toLowerCase();
  if (!q) {
    renderMarkers();
    renderSidebar(places);
    return;
  }
  const filtered = places.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      (p.brands || []).some((b) => b.toLowerCase().includes(q))
  );
  renderMarkers(filtered);
  renderSidebar(filtered);
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
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("active");
}

document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("btn-cancel").addEventListener("click", closeModal);
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// 브랜드 체크박스 토글
document.querySelectorAll(".brand-checkbox").forEach((el) => {
  el.addEventListener("click", () => {
    const val = el.dataset.value;
    el.classList.toggle("checked");
    if (val === "기타") {
      document.getElementById("brand-other-input").style.display = el.classList.contains("checked") ? "block" : "none";
    }
  });
});

// ─── 주소 → 좌표 변환 (네이버 Geocoding) ─────────

document.getElementById("btn-search-address").addEventListener("click", async () => {
  const address = document.getElementById("input-address").value.trim();
  if (!address) {
    showToast("주소를 먼저 입력해 주세요.");
    return;
  }

  const btn = document.getElementById("btn-search-address");
  btn.textContent = "검색 중...";
  btn.disabled = true;

  try {
    await new Promise((resolve, reject) => {
      naver.maps.Service.geocode({ query: address }, (status, response) => {
        if (status === naver.maps.Service.Status.ERROR) {
          reject(new Error("Geocoding 실패"));
          return;
        }
        if (!response.v2.addresses || response.v2.addresses.length === 0) {
          reject(new Error("주소를 찾을 수 없습니다. 더 구체적으로 입력해 주세요."));
          return;
        }
        const result = response.v2.addresses[0];
        geocoderResult = { lat: parseFloat(result.y), lng: parseFloat(result.x) };
        updateCoordsDisplay(geocoderResult.lat, geocoderResult.lng);
        showToast("주소 확인 완료!", "success");
        resolve();
      });
    });
  } catch (e) {
    showToast(e.message, "error");
    geocoderResult = null;
    updateCoordsDisplay(null, null);
  } finally {
    btn.textContent = "주소 확인";
    btn.disabled = false;
  }
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

  // 선택된 브랜드 수집
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

    // 지도를 새 가게 위치로 이동
    map.panTo(new naver.maps.LatLng(geocoderResult.lat, geocoderResult.lng));
    map.setZoom(16);
  } catch (err) {
    console.error(err);
    showToast("등록 중 오류가 발생했습니다. 다시 시도해 주세요.", "error");
  } finally {
    btn.textContent = "가게 등록하기";
    btn.disabled = false;
  }
});

// ─── Toast 알림 ────────────────────────────────────

function showToast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `${type}`;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

// ─── 지도 로딩 메시지 ─────────────────────────────

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
  const ok = initFirebase();
  if (!ok) return;
  // initMap은 네이버 맵 스크립트 로드 완료 후 callback으로 호출됨
};
