# 윤코치 (YoonCoach) - 다이어트 매크로 코치 PWA

윤코치(YoonCoach)는 사용자의 목표 체중과 기간에 맞춰 하루에 섭취해야 할 칼로리와 탄수화물, 단백질, 지방(매크로) 양을 매일 관리해주는 Progressive Web App (PWA) 입니다. 매일의 체중과 식단 준수 상태를 체크하고, 주기적인 코칭 기능으로 성공적인 다이어트 여정을 돕기 위해 만들어졌습니다.

## 🚀 주요 기능

- **온보딩 마법사**: 성별, 나이, 체중, 활동량, 목표(감량/증량) 등을 단계별로 입력받아 초기 권장 칼로리와 매크로를 생성합니다. (권장: 2주 캘리브레이션)
- **홈 대시보드 (오늘의 기록)**: 오늘 먹어야 할 목표 KPI를 확인하고, 단 10초 만에 공복 체중과 식단 준수율(잘 지켰어요/애매해요/못 지켰어요)을 저장할 수 있습니다. 섭취한 칼로리를 직접 수기로 입력하는 기능도 제공합니다.
- **자동 체중 변화 추적 & AI 코칭 시스템**: 
  - 최근 7~14일간의 체중 변화량 평균과 식단 데이터를 분석하여, 매주 적절한 다음 주 칼로리와 매크로를 **자동으로 조정**해 줍니다. 
  - `OPENAI_API_KEY`를 연동하면 생성형 AI의 지능적인 텍스트 피드백을 받을 수 있습니다. (키가 없어도 내부 알고리즘 매트릭스를 통해 자동으로 안전한 코드가 작동합니다.)
- **PWA 앱 환경 지원**: 모바일 브라우저 환경에서 스마트폰 홈 화면에 아이콘을 추가하여, 별도의 앱 마켓 설치 없이 일반 모바일 앱처럼 사용할 수 있습니다.

## 🛠 기술 스택

- **Framework**: Next.js 15 (App Router 기반), React 19
- **Language**: TypeScript
- **Database**: Prisma ORM, SQLite (`dev.db`)
- **Styling**: Tailwind CSS
- **Push & Utility**: Web-Push(푸시 알림), Zod(데이터 검증 로직) 등

## 💻 설치 및 로컬 실행 방법

1. **저장소 클론 및 패키지 설치**
   터미널(또는 명령 프롬프트)을 열고 아래 명령어를 순서대로 입력합니다.
   ```bash
   git clone https://github.com/sejun42/YoonCoach.git
   cd YoonCoach
   npm install
   ```

2. **환경 변수 파일 생성**
   코드 최상단(루트 디렉토리)에 있는 `.env.example` 파일을 복사해 `.env` 파일로 만듭니다.
   ```bash
   cp .env.example .env
   # 또는 윈도우 환경: copy .env.example .env
   ```

3. **데이터베이스 초기화 및 Prisma 생성**
   SQLite 데이터베이스 파일과 스키마를 구성합니다.
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

4. **개발 서버 실행**
   ```bash
   npm run dev
   ```
   실행이 완료되면 터미널에 나온 주소(예: `http://localhost:3000`)를 브라우저에 입력하여 접속합니다. 접속 후 회원가입부터 진행하시면 됩니다.

## ⚙️ 환경 변수 설정 가이드 (`.env`)

이 프로젝트가 완벽하게 돌아가기 위해서는 `.env` 파일을 다음과 같이 설정해야 합니다. (OpenAI 관련은 필수가 아닙니다.)

```env
# 데이터베이스 연결
DATABASE_URL="file:./dev.db"

# 세션 암호화 키 (무작위 긴 영문/숫자 조합을 추천합니다)
AUTH_SECRET="your-random-secret-key-replace-me"

# (선택) AI 코칭 기능 - 맞춤형 텍스트 피드백이 필요할 경우
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini" # (기본값 설정됨)

# PWA 푸시 알림 설정 (자체 알림 서버 VAPID 키)
# `npx web-push generate-vapid-keys` 명령어로 생성할 수 있습니다.
WEB_PUSH_PUBLIC_KEY="your-public-key"
WEB_PUSH_PRIVATE_KEY="your-private-key"
WEB_PUSH_EMAIL="mailto:admin@example.com"

# 서버 스케줄러(Cron) 인증에 사용될 무작위 문자열
CRON_SECRET="your-cron-secret-key"
```

## 📬 주요 시나리오 및 기능 개요

- **2주 캘리브레이션 (Calibration)**: 가입 직후 곧바로 극단적인 식단을 진행하지 않고 2주 동안 평소 체중 변동 추이를 스캔합니다. 데이터가 모이면 실제 체중 유지에 필요한 칼로리를 도출하여 플랜(감량/벌크) 모드로 자동 전환합니다.
- **코칭 안전장치 (Guardrails)**: 감량 시기에 체중이 줄어들지 않으면 칼로리를 점진적으로 줄이되, 사용자의 기초대사량(Floor) 밑으로는 절대 내려가지 않도록 하는 보호 로직이 적용되어 건강한 다이어트를 유도합니다.

**문제가 발생했거나 건의사항이 있다면 GitHub Issues에 자유롭게 남겨주세요!**
