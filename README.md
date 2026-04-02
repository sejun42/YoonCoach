# YoonCoach - AI-Powered Diet and Macro Coaching PWA

> **Personalized calorie and macronutrient management with automated weekly adjustments and AI coaching**


[![Live Demo](https://img.shields.io/badge/Live-yoon--coach.vercel.app-00C853)](https://yoon-coach.vercel.app)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-97.6%25-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)

---

## Overview

YoonCoach is a **Progressive Web App (PWA)** that calculates daily calorie and macronutrient targets based on a user's body composition and fitness goals, then automatically adjusts recommendations weekly using weight-trend analysis and optional AI coaching.

Built as a personal tool reflecting the developer's background as a **certified sports instructor (bodybuilding)** and interest in human-centered AI applications for health and fitness.

### Key Features

| Feature | Description |
|---|---|
| **Onboarding Wizard** | Step-by-step profile setup (gender, age, weight, activity level, goal) |
| **Daily Dashboard** | 10-second daily check-in: body weight + diet adherence |
| **2-Week Calibration** | Initial observation period to establish true maintenance calories |
| **Auto-Adjustment** | Weekly calorie/macro recalculation based on 7-14 day weight trends |
| **AI Coaching** | OpenAI GPT integration for personalized text feedback (optional) |
| **Safety Guardrails** | Never drops calories below estimated BMR floor |
| **PWA Support** | Installable on mobile home screen, no app store needed |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript |
| Database | Prisma ORM + SQLite |
| Styling | Tailwind CSS |
| AI | OpenAI GPT API (optional) |
| Notifications | Web-Push |
| Validation | Zod |
| Deployment | Vercel |

## Getting Started

```bash
# 1. Clone and install
git clone https://github.com/sejun42/YoonCoach.git
cd YoonCoach
npm install

# 2. Environment setup
cp .env.example .env

# 3. Database setup
npx prisma migrate dev --name init
npx prisma generate

# 4. Run dev server
npm run dev
```

## Context

This project demonstrates:
- **Full-stack development** with modern frameworks (Next.js 15, Prisma, TypeScript)
- - **Domain expertise** in sports science and nutrition
  - - **AI integration** for personalized user experiences
    - - **Algorithm design** for safe, adaptive calorie adjustment
     
      - ## Contact
     
      - - **Sejun Yoon** - sejun1324@gmail.com
        - - GitHub: @sejun42
          - 
