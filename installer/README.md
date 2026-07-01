# App Data Center Installer

ชุดติดตั้งนี้ใช้สำหรับรันเฉพาะแอปด้วย Docker Compose และใช้ MariaDB/MySQL ที่แยกจาก Docker
ไฟล์ SQL สำหรับ import ฐานข้อมูลอยู่ในโฟลเดอร์ `data/`

## Files

- `docker-compose.yml` รันเฉพาะ `app` container
- `.env.example` ตัวอย่างค่าคอนฟิกสำหรับติดตั้ง
- `data/01-schema.sql` โครงสร้างฐานข้อมูล
- `data/02-baseline-data.sql` ข้อมูลตั้งต้นและสถานะ Prisma migration

## 1. Prepare External Database

ติดตั้งหรือเตรียม MariaDB/MySQL บนเครื่องหรือ server ภายนอก แล้วสร้าง user ให้แอปใช้งาน

```sql
CREATE DATABASE IF NOT EXISTS app_data_center
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'app_user'@'%' IDENTIFIED BY 'app_password_change_me';
GRANT ALL PRIVILEGES ON app_data_center.* TO 'app_user'@'%';
FLUSH PRIVILEGES;
```

ถ้า database server จำกัด host ให้เปลี่ยน `'%'` เป็น IP หรือ host ของเครื่องที่รัน Docker

## 2. Import Data

Import ไฟล์ตามลำดับนี้เท่านั้น

```bash
mysql --default-character-set=utf8mb4 -h db-host -u app_user -p < data/01-schema.sql
mysql --default-character-set=utf8mb4 -h db-host -u app_user -p < data/02-baseline-data.sql
```

ถ้า `app_user` ไม่มีสิทธิ์ `CREATE DATABASE` หรือ `DROP/CREATE TABLE` ให้ใช้ user admin/root สำหรับ import ครั้งแรก
แล้วให้แอปเชื่อมต่อด้วย `app_user` ตาม `DATABASE_URL`

คำเตือน: ไม่ควร import SQL ทับ database ที่มีข้อมูลใช้งานจริง เว้นแต่ backup แล้วและตั้งใจ reset ข้อมูล
ไฟล์ `02-baseline-data.sql` มีข้อมูลตั้งต้น เช่น user, asset category, checklist, system setting และ `_prisma_migrations`

## 3. Configure App

คัดลอก `.env.example` เป็น `.env`

```bash
cp .env.example .env
```

แก้ค่าอย่างน้อย

```env
DATABASE_URL=mysql://app_user:app_password_change_me@db-host:3306/app_data_center
JWT_SECRET=change-this-to-a-long-random-secret-before-production
APP_URL=http://localhost:3000
SERVER_ACTION_ALLOWED_ORIGINS=localhost:3000,127.0.0.1:3000
```

ถ้า password มีอักขระพิเศษสำหรับ URL เช่น `@`, `#`, `/`, `?`, `:` ให้ URL-encode password ก่อนใส่ใน `DATABASE_URL`

## 4. Start App

```bash
docker compose pull
docker compose up -d
```

เปิดเว็บที่

```text
http://localhost:3000
```

หรือ URL/port ที่ตั้งไว้ใน `.env`

## 5. Useful Commands

```bash
docker compose ps
docker compose logs -f app
docker compose restart app
docker compose down
```

`docker compose down` จะหยุดเฉพาะ app container และไม่ลบฐานข้อมูลภายนอก
ตอน start แอปจะรัน `npx prisma migrate deploy` ก่อน `npm run start` เพื่อ apply migration ที่ยังขาดอยู่
