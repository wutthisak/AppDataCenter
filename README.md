# App Data Center

เว็บแอป Node.js/Next.js สำหรับบันทึกรายงานสถานะระบบประจำเดือน, จัดการจำนวน server/asset, บันทึก CPU/RAM/Disk, ดูแนวโน้ม disk growth, เปิดใช้ Google Authenticator 2FA และ export PDF พร้อมพิมพ์

## Stack

- Next.js App Router
- Prisma ORM
- MySQL/MariaDB
- JWT cookie session
- Google Authenticator compatible TOTP
- Playwright PDF export
- Recharts dashboard

## Setup

1. ติดตั้ง Node.js 20+
2. สร้างฐานข้อมูล MySQL/MariaDB
3. คัดลอก `.env.example` เป็น `.env` แล้วแก้ `DATABASE_URL` และ `JWT_SECRET`
4. ติดตั้ง dependency และสร้างฐานข้อมูล

```bash
npm install
npx playwright install chromium
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

เปิดเว็บที่ `http://localhost:3000`

## Run with Docker on Ubuntu

เหมาะสำหรับ Ubuntu 24 LTS ใน VMware Workstation ที่มี Docker อยู่แล้ว

```bash
docker compose up -d --build
```

เปิดเว็บที่ `http://localhost:3000`

คำสั่งที่ใช้บ่อย:

```bash
docker compose logs -f app
docker compose restart app
docker compose down
docker compose down -v
```

หมายเหตุ: `docker compose down -v` จะลบ volume ฐานข้อมูลด้วย ใช้เฉพาะตอนต้องการล้างข้อมูลทั้งหมด

ก่อนใช้จริงควรแก้ค่าใน `docker-compose.yml`:

- `MARIADB_PASSWORD`
- `MARIADB_ROOT_PASSWORD`
- `DATABASE_URL`
- `JWT_SECRET`

บัญชีตั้งต้นหลัง seed:

- Username: `admin`
- Password: `admin1234`

## Features

- Dashboard สรุปสถานะรายเดือนและกราฟแนวโน้ม disk
- รายงานรายวันรูปแบบรายการระบบ x วันที่ 1-31
- จัดการ asset ได้ที่หน้า Admin โดยปิดใช้งานแทนการลบ เพื่อรักษาข้อมูลย้อนหลัง
- Server Metrics สำหรับกรอก CPU, RAM, Disk และรายละเอียดประกอบ
- Export PDF ตามฟอร์มรายงานพร้อมช่องผู้ตรวจสอบ
- เปิดใช้ 2FA ผ่าน Google Authenticator ได้ที่หน้า Security

## Production Notes

- เปลี่ยนรหัสผ่าน admin ทันทีหลังติดตั้ง
- ตั้ง `JWT_SECRET` เป็นค่าสุ่มยาวอย่างน้อย 24 ตัวอักษร
- ใช้ HTTPS เมื่อเปิดใช้งานนอก localhost
- สำรองฐานข้อมูล MySQL/MariaDB เป็นประจำ
- ติดตั้ง Chromium สำหรับ Playwright บน server ที่ใช้ export PDF
