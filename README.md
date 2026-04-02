# YoonCoach — AI-Powered Diet and Macro Coaching PWA

> A progressive web app for daily weight tracking, macro planning, automated weekly adjustment, and optional AI coaching

[![Live Demo](https://img.shields.io/badge/Live-yoon--coach.vercel.app-00C853)](https://yoon-coach.vercel.app)
![Next.js](https://img.shields.io/badge/Next.js-App%20Router-000000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-React%2019-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-Data%20Layer-2D3748?logo=prisma)

---

## Overview

YoonCoach is a full-stack PWA for nutrition coaching and body-weight management.

The app helps a user:

- set a goal and onboarding profile
- calculate an initial calorie and macro plan
- record daily weigh-ins and adherence
- review progress over time
- receive weekly plan adjustments
- optionally generate AI-assisted coaching summaries

The project is designed around practical dieting workflows rather than generic calorie logging. The core logic emphasizes adaptive targets, simple daily input, and guardrails that keep recommendations from becoming too aggressive.

## Product Flow

```text
Onboarding
   |
   v
Initial plan calculation
   |
   v
Daily weigh-ins + adherence check-ins
   |
   v
Dashboard / graphs / history
   |
   v
Weekly coaching evaluation
   |
   +--> keep current plan
   +--> increase calories
   `--> decrease calories
```

## Key Features

| Feature | Details |
| --- | --- |
| Onboarding wizard | Collects profile, activity level, and goal information |
| Initial planning | Computes calorie and macro targets from BMR/TDEE-based logic |
| Daily check-ins | Records weight and adherence in a lightweight daily workflow |
| Weekly adjustment | Re-evaluates targets from trend data and consistency signals |
| Coaching history | Stores applied or suggested coaching outputs |
| Optional AI coaching | Uses OpenAI output when configured |
| Notifications | Includes push-subscription endpoints and scheduled reminder hooks |
| PWA support | Manifest and service worker included for installable mobile experience |

## Repository Layout

```text
YoonCoach/
|- src/app/
|  |- page.tsx                       # Main dashboard/home
|  |- onboarding/page.tsx           # Onboarding flow
|  |- graph/page.tsx                # Progress graphs
|  |- coaching/page.tsx             # Coaching UI
|  |- settings/page.tsx             # User settings
|  `- api/
|     |- auth/                      # Login / signup / logout
|     |- plan/                      # Current plan and initialization
|     |- weighins/                  # Weight tracking
|     |- checkins/                  # Daily adherence logging
|     |- coaching/                  # Coaching history / runs / cron
|     `- push/                      # Push subscription and daily cron hooks
|- src/components/                  # UI modules such as dashboard, wizard, graph, coaching
|- src/lib/
|  |- calculations.ts               # BMR, TDEE, macros, rate calculations
|  |- services/coaching.ts          # Coaching decision logic and AI integration
|  |- db.ts                         # Prisma client
|  `- schemas.ts                    # Validation rules
|- prisma/
|  |- schema.prisma                 # User, profile, plan, weigh-in, coaching models
|  `- migrations/
|- public/
|  |- manifest.webmanifest
|  `- sw.js
`- package.json
```

## Technical Notes

### Calculation layer

`src/lib/calculations.ts` includes the core nutrition math:

- BMR estimation
- TDEE estimation from activity level
- calorie floor logic
- macro target calculation
- weekly rate calculations
- initial plan generation

### Coaching layer

`src/lib/services/coaching.ts` combines:

- recent weigh-in trends
- adherence quality
- intake completeness
- plan phase (`calibration`, `cut`, `bulk`)
- fallback deterministic coaching
- optional OpenAI-assisted structured output

### Data model

The Prisma schema currently models:

- users and profiles
- active/inactive plans
- weigh-ins
- daily check-ins
- coaching logs
- push subscriptions
- user settings

## Tech Stack

- Next.js App Router
- React 19
- TypeScript
- Prisma
- Zod
- Tailwind CSS
- Web Push
- OpenAI API (optional)

## Getting Started

### Install

```bash
git clone https://github.com/sejun42/YoonCoach.git
cd YoonCoach
npm install
```

### Environment setup

```bash
cp .env.example .env
```

Common variables used by the project include:

- `DATABASE_URL`
- `AUTH_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_EMAIL`

Before running migrations, make sure your database configuration matches the Prisma schema and your target environment.

### Database and dev server

```bash
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Then open `http://localhost:3000`.

## Why This Project Is Different

YoonCoach is not just a calorie calculator UI. The repository also contains:

- plan-phase-aware coaching logic
- automatic weekly adjustment rules
- adherence-sensitive fallback coaching
- API routes for cron-triggered coaching and push reminders
- a PWA shell intended for real daily use

That makes it a more complete product experiment in behavior change and nutrition tooling rather than a static macro calculator.

## Contact

- Sejun Yoon — [sejun1324@gmail.com](mailto:sejun1324@gmail.com)
- GitHub — [@sejun42](https://github.com/sejun42)
