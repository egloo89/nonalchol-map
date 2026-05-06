# 논알콜 맥주 술집 지도

술을 줄이거나 금주 중인 분들을 위해, 논알콜 맥주를 함께 파는 술집을 모아두는 지도 웹사이트입니다.

---

## 🚀 처음 설정하기 (한 번만 하면 됩니다)

아래 4단계를 순서대로 따라 하면 사이트가 완성됩니다. 개발 지식이 없어도 따라 할 수 있습니다.

---

### 1단계: 네이버 클라우드 플랫폼 - 지도 API 키 발급

1. [네이버 클라우드 플랫폼](https://www.ncloud.com) 에 접속해서 회원가입/로그인합니다.
2. 오른쪽 위 **Console** 클릭 → 왼쪽 메뉴에서 **AI·NAVER API** → **Maps** 클릭
3. **Application 등록** 클릭
   - Application 이름: 아무 이름이나 입력 (예: `논알콜맵`)
   - Service 선택: **Maps** 체크
   - Web 서비스 URL: 나중에 배포한 주소를 넣으면 됩니다. 지금은 `http://localhost` 라고 입력
4. 등록 후 생성된 **Client ID** 를 복사해 둡니다.

---

### 2단계: Firebase - 데이터베이스 만들기

1. [Firebase 콘솔](https://console.firebase.google.com) 에 접속합니다 (구글 계정 필요).
2. **프로젝트 추가** 클릭 → 이름 입력 (예: `nonalcohol-map`) → 구글 애널리틱스는 꺼도 됩니다.
3. 프로젝트 생성 후, 왼쪽 메뉴에서 **Firestore Database** 클릭 → **데이터베이스 만들기** 클릭
   - **테스트 모드로 시작** 선택 (나중에 보안 규칙을 설정할 수 있습니다)
   - 위치: `asia-northeast3 (서울)` 선택
4. 왼쪽 메뉴 상단의 **프로젝트 개요** 옆 ⚙️ 아이콘 → **프로젝트 설정** 클릭
5. 아래로 스크롤하면 **내 앱** 섹션이 있습니다. `</>` (웹) 아이콘을 클릭합니다.
   - 앱 닉네임 입력 (아무거나) → **앱 등록** 클릭
6. 화면에 표시되는 `firebaseConfig` 객체 안의 값들을 복사해 둡니다.

---

### 3단계: `firebase-config.js` 파일 수정

`firebase-config.js` 파일을 메모장(또는 텍스트 편집기)으로 열고,
아래 값들을 2단계와 1단계에서 복사한 값으로 교체합니다.

```js
const FIREBASE_CONFIG = {
  apiKey: "여기에_API키_입력",           // Firebase에서 복사
  authDomain: "여기에_authDomain_입력",
  projectId: "여기에_projectId_입력",
  storageBucket: "여기에_storageBucket_입력",
  messagingSenderId: "여기에_messagingSenderId_입력",
  appId: "여기에_appId_입력"
};

const NAVER_MAP_CLIENT_ID = "여기에_네이버맵_ClientID_입력"; // 1단계에서 복사
```

저장하면 설정 완료입니다.

---

### 4단계: 웹에 올리기 (배포)

가장 쉬운 방법은 **GitHub Pages** 를 사용하는 것입니다. 무료입니다.

1. [GitHub](https://github.com) 회원가입/로그인
2. 오른쪽 위 **+** → **New repository** 클릭
   - Repository name: `nonalcohol-map` (원하는 이름)
   - **Public** 선택
   - **Create repository** 클릭
3. 파일 업로드: 생성된 저장소 페이지에서 **uploading an existing file** 클릭
   - `index.html`, `style.css`, `app.js`, `firebase-config.js` 4개 파일을 드래그해서 업로드
   - **Commit changes** 클릭
4. **Settings** 탭 → 왼쪽 **Pages** 클릭
   - Source: **Deploy from a branch** 선택
   - Branch: `main`, `/ (root)` 선택 → **Save**
5. 몇 분 후 상단에 나타나는 주소 (예: `https://내아이디.github.io/nonalcohol-map/`) 가 사이트 주소입니다!

> **중요:** 사이트 주소가 생기면, 네이버 클라우드 플랫폼으로 돌아가서  
> 만든 Application의 **Web 서비스 URL** 에 이 주소를 추가해 주세요.

---

## 🔒 Firebase 보안 규칙 (스팸 방지)

초기에는 테스트 모드로 누구나 읽고 쓸 수 있습니다.  
어느 정도 운영하다가 스팸이 걱정되면 아래 규칙으로 변경하세요.

Firebase 콘솔 → Firestore Database → **규칙** 탭에 아래를 붙여넣기:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /places/{placeId} {
      // 누구나 읽기 가능
      allow read: if true;
      // 쓰기: 기본 유효성 검사만
      allow create: if request.resource.data.name is string
                    && request.resource.data.name.size() > 0
                    && request.resource.data.address is string
                    && request.resource.data.lat is number
                    && request.resource.data.lng is number;
      // 수정/삭제: 금지 (관리자만 Firebase 콘솔에서 직접)
      allow update, delete: if false;
    }
  }
}
```

---

## 📱 사용 방법

- **지도 보기**: 사이트에 접속하면 바로 지도와 가게 목록이 보입니다.
- **마커 클릭**: 지도의 파란 핀을 클릭하면 가게 상세 정보가 나타납니다.
- **가게 추가**: 오른쪽 위 **＋ 가게 추가** 버튼 → 정보 입력 → 등록
- **검색**: 왼쪽 검색창에 가게명, 주소, 브랜드 이름 입력

---

## 📂 파일 구조

```
nonalchol-map/
├── index.html          # 메인 화면
├── style.css           # 디자인
├── app.js              # 기능 코드
└── firebase-config.js  # ← 설정값 입력하는 파일
```
