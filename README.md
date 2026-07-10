# JKP WorkHub — Web Version

통합 업무 관리 플랫폼의 웹 버전입니다.  
Google 로그인 기반 개인 맞춤형 업무 관리, 부서원 업무 공유 기능을 제공합니다.

## 🚀 배포 환경
- **Frontend + API**: Vercel (Next.js 14 App Router)
- **Database**: Neon PostgreSQL (Vercel Integration)
- **파일 저장**: 로컬 브릿지 서버 (`bridge-server.js`)

## 📋 주요 기능
- Google OAuth 로그인
- 개인 업무 관리 (Kanban, 리스트)
- 부서원 업무 열람 (상호 동의 방식, 최대 50명)
- AI 업무 캡처 (Gemini 2.5 Flash)
- 로컬 파일 탐색기 (브릿지 서버 연결 시)

## ⚙️ 설정 방법

### 1. 환경변수 설정
```bash
cp .env.example .env.local
# .env.local 파일을 열고 값 입력
```

### 2. Google OAuth 설정
1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 생성
3. 승인된 리디렉션 URI 추가:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-vercel-domain.vercel.app/api/auth/callback/google`

### 3. Neon DB 설정
1. [Vercel Dashboard](https://vercel.com/dashboard) → Storage → Create Database → Neon 선택
2. `DATABASE_URL` 환경변수 복사

### 4. DB 초기화 (첫 배포 후 1회)
```
https://your-domain.vercel.app/api/init
```

### 5. 개발 서버 실행
```bash
npm run dev
```

### 6. 로컬 브릿지 서버 실행 (파일 탐색기 사용 시)
```bash
# bridge 폴더 내에서
node bridge-server.js
# 또는 브릿지_시작.bat 더블클릭
```

## 🔐 보안
- Gemini API Key는 서버사이드에서만 관리 (클라이언트 노출 없음)
- 브릿지 서버는 localhost에만 바인딩 (외부 접근 불가)
- 부서원 업무는 상호 동의 후에만 열람 가능

## 📁 프로젝트 구조
```
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  # Google OAuth
│   │   ├── tasks/               # 업무 CRUD
│   │   ├── workcards/           # 명함첩
│   │   ├── members/             # 부서원 관리
│   │   ├── ai/                  # Gemini AI 프록시
│   │   └── init/                # DB 초기화
│   ├── login/                   # 로그인 페이지
│   └── page.tsx                 # 메인 앱
├── lib/
│   ├── db.ts                    # Neon DB 클라이언트
│   └── auth.ts                  # NextAuth 설정
├── bridge-server.js             # 로컬 브릿지 서버
└── 브릿지_시작.bat               # 브릿지 시작 스크립트
```
