# 🧱 Next.js + FastAPI Identity Verification App

Проектът представлява **модерно full-stack приложение за удостоверяване на самоличност**, съчетаващо:

- Next.js frontend за автентикация, качване на документи и селфи
- FastAPI backend с DeepFace за сравнение на лице от документ със селфи
- Prisma ORM за свързване с база данни (MySQL)
- Husky + ESLint за pre-commit hook проверки

---

## ⚙️ Технологии и Стек

- **Next.js 14+** (App Router, Typescript)
- **React + Bootstrap 5**
- **FastAPI + DeepFace + OpenCV**
- **Prisma ORM + MySQL**
- **Husky + ESLint**
- **FormData + файлове + preview**
- **Camera detection + step-by-step flow**

---

## 🧑‍💼 Функционалности

- 🔐 Регистрация и вход с валидиран email и парола
- 🧾 Документна верификация с 3 файла: предна, задна страна и селфи
- 🧠 Логика за camera detection, timeout-и и fallback UI
- 📄 Поддържка на `.env` променливи и настройваеми threshold стойности за AI

---

## 🗃️ Структура

```
.
├── app/                    # Next.js App Router
├── components/             # AuthForm.js
├── prisma/                 # schema.prisma, migration.sql
├── server.py               # FastAPI + DeepFace backend
├── public/
├── .env
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── package.json
└── ...
```

---

## 🚀 Стартиране на проекта

### 📦 Frontend

```bash
npm install
npm run dev
# или: pnpm dev / bun dev / yarn dev
```

### 🧠 Backend (FastAPI + DeepFace)

1. Инсталирай зависимостите:
```bash
pip install fastapi uvicorn[standard] deepface opencv-python
```

2. Стартирай сървъра:
```bash
python server.py
```

---

## 🔐 .env Пример

```dotenv
DATABASE_URL=mysql://user:pass@localhost:3306/mydb
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

---

## 🧪 Git Hooks с Husky

```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run lint"
```

---

## 🔄 Верификация с FastAPI

### Endpoint: `POST /verify`

- Параметри:
  - `idCardFront`: Файл (.jpg/.png) – предна страна на документ
  - `idCardBack`: Файл (.jpg/.png) – задна страна (не се анализира)
  - `selfie`: Файл (.jpg/.png) – селфи

- Отговор:
```json
{
  "status": "success",
  "verified": true,
  "distance": 0.312,
  "threshold": 0.593,
  "model": "SFace",
  "detector": "mtcnn"
}
```

---

## ✅ TODO

- [ ] Интеграция с хостинг платформи (Vercel, Railway, Render)
- [ ] Docker контейнеризация
- [ ] Test coverage с Vitest / Pytest
- [ ] UI polishing & preview модул

---

## 📄 Лиценз

MIT License – свободен за използване и модификация.