// =====================================================
// Firebase 설정 파일
// 아래 값들을 본인의 Firebase 프로젝트 설정값으로 교체하세요.
// 설정 방법: README.md 파일의 "Firebase 설정" 단계를 참고하세요.
// =====================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDG15N1TK5mSKTgYsJz5huZjQWlQDbWDjM",
  authDomain: "non-alchol-map.firebaseapp.com",
  projectId: "non-alchol-map",
  storageBucket: "non-alchol-map.firebasestorage.app",
  messagingSenderId: "950373297714",
  appId: "1:950373297714:web:767553592e5913afa3562b"
};

// =====================================================
// 카카오맵 JavaScript 키
// kakao developers > 앱 > 플랫폼 키 > JavaScript 키
// =====================================================

const KAKAO_MAP_KEY = "96651efd5ec0fb0a78ea99976a5eb85f";

// =====================================================
// 카카오 로그인용 REST API 키 (지도 JS 키와 다름!)
// kakao developers > 앱 > 앱 키 > REST API 키
// 카카오 로그인 토큰 발급에 사용됩니다.
// =====================================================

const KAKAO_REST_KEY = "636b21b25cec53007bc04ac14ae9457f";

// =====================================================
// 네이버 로그인 Client ID
// naver developers > 애플리케이션 등록 후 발급
// 발급 전까지는 빈 문자열로 두면 "준비 중"으로 표시됩니다.
// =====================================================

const NAVER_CLIENT_ID = "RhCb44eK3eolEQf4YbWm";

// =====================================================
// 관리자 계정 (이메일 원문 대신 SHA-256 지문만 저장)
// 이 파일은 누구나 볼 수 있으므로 이메일 주소를 그대로 두지 않는다.
// 관리자를 추가하려면: 사이트에서 브라우저 콘솔을 열고
//   await adminEmailHash("새관리자@example.com")
// 을 실행해 나온 값을 아래 목록에 한 줄 추가한다.
// =====================================================

const ADMIN_EMAIL_HASHES = [
  "4deaaa3d1d6518fef362e650cdfa8bdc3805381b77f30f8bc54fa44446e966d6",
  "ed3c5f1ca9048078ae1cd2790fecf9d36794755403a8685f39c00d7a25ed1616",
];

async function adminEmailHash(email) {
  const data = new TextEncoder().encode(String(email || "").trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function isAdminEmailAsync(email) {
  if (!email) return false;
  try { return ADMIN_EMAIL_HASHES.includes(await adminEmailHash(email)); } catch (e) { return false; }
}

