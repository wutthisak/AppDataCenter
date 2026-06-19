# AppDataCenter Handoff for Copilot

## Project Goal
Build a modern Node.js web app for monthly data center reporting.

The app should replace an Excel monthly report form and support:
- Multi-user login
- Roles: `ADMIN`, `INPUTTER`, `REVIEWER`
- MySQL/MariaDB database
- Dashboard with modern UI
- Daily status reporting for VM/server/network/backup
- Add/disable server/assets
- Server CPU/RAM/Disk metric reporting
- Disk usage growth trend
- Google Authenticator 2FA
- PDF export for printed reports

## Tech Stack
- Next.js 14 App Router
- React 18
- Prisma ORM
- MySQL/MariaDB
- Docker Compose
- Playwright for PDF export
- Recharts for dashboard charts
- `otplib` + `qrcode` for Google Authenticator 2FA
- `bcryptjs` for password hashing
- `jose` for JWT cookie sessions

## Important Files
- `package.json`
- `Dockerfile`
- `docker-compose.yml`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `app/actions.ts`
- `app/page.tsx`
- `app/login/page.tsx`
- `app/reports/page.tsx`
- `app/reports/[id]/page.tsx`
- `app/servers/page.tsx`
- `app/admin/assets/page.tsx`
- `app/admin/users/page.tsx`
- `app/security/page.tsx`
- `app/api/reports/[id]/pdf/route.ts`
- `components/AppShell.tsx`
- `components/DashboardCharts.tsx`
- `components/StatusForm.tsx`
- `lib/auth.ts`
- `lib/constants.ts`
- `lib/date.ts`
- `lib/prisma.ts`
- `lib/report.ts`
- `lib/totp.ts`

## Docker Setup
The user has Ubuntu 24 LTS running in VMware Workstation, with Docker available.

Run:

```bash
docker compose up -d --build