# ITAS Backend (Express + JWT + Forgot/Reset + TOTP 2FA, file DB)

## Run
```bash
npm install
cp .env.example .env
npm run dev
```
Server: http://localhost:3000

### Endpoints
- POST `/api/auth/register`
- POST `/api/auth/login`
- POST `/api/auth/2fa/login`
- POST `/api/auth/2fa/setup`
- POST `/api/auth/2fa/verify`
- POST `/api/auth/forgot`
- POST `/api/auth/reset`
- GET  `/api/auth/me`
- POST `/api/auth/refresh`
- POST `/api/auth/logout`
