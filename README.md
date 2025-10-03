# 🔐 Authentication System with Face Verification

A modern authentication system with **Next.js, Prisma and Python AI** that combines classic login (email/password) with **biometric face verification**.

## ✨ Features
- 🔑 **Registration and login** with email and password
- 📸 **Camera integration** – photos directly in the browser
- 🧑‍💻 **Biometric verification** – comparison of ID card/passport with selfie (AI-powered)
- 🛡️ **Security** – bcrypt encryption, input validation, sessions with iron-session
- 🎨 **UI** – Bootstrap 5, responsive design

## 🛠️ Technologies
- **Frontend:** Next.js 15, React 19, TypeScript, Bootstrap 5
- **Backend:** Next.js API Routes, Prisma, MySQL, iron-session
- **AI/ML:** Python 3.11, DeepFace, TensorFlow, OpenCV, Flask

## 🚀 Installation
```bash
# 1. Clone
git clone https://github.com/your-username/authentication-revolut.git
cd authentication-revolut

# 2. Node.js dependencies
npm install

# 3. Python virtual environment
python -m venv venv
source venv/bin/activate # (Linux/Mac) or venv\Scripts\activate (Windows)
pip install -r venv/requirements.txt

# 4. Set up database
cp .env.example .env
npx prisma migrate dev
```

## ⚙️ Start
```bash
npm run dev # Next.js dev server
python scripts/verify_face.py # Python AI service
```

## 🔌 API Endpoints
- `POST /api/auth` – registration/login
- `POST /api/auth/verify` – biometric verification
