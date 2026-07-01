# Deploy with Docker Hub Images

คู่มือนี้สำหรับนำแอปไปติดตั้งบนเครื่องอื่นโดยใช้ image จาก Docker Hub ทั้งส่วน app และ database
ไม่ต้อง build จาก source บนเครื่องปลายทาง

## Images

- App: `mooping/app-data-center:latest`
- Database: `mooping/app-data-center-db:latest`

Database image ฝังไฟล์ SQL ตั้งต้นไว้ใน `/docker-entrypoint-initdb.d` แล้ว:

- `01-schema.sql` โครงสร้างฐานข้อมูล
- `02-baseline-data.sql` ข้อมูลตั้งต้น เช่น asset, category, checklist และ system setting

MariaDB จะ import SQL อัตโนมัติเฉพาะครั้งแรกที่ path ข้อมูล DB ยังว่างเท่านั้น
ค่าเริ่มต้นเก็บข้อมูลไว้ที่ `./data/mariadb` ตามตัวแปร `DB_DATA_PATH`

## Install on Another Machine

1. ติดตั้ง Docker และ Docker Compose
2. นำไฟล์ `docker-compose.yml` และ `.env` ไปไว้ในโฟลเดอร์เดียวกัน
3. สร้าง `.env` จาก `.env.example` แล้วแก้ค่าอย่างน้อย:

```env
APP_IMAGE=mooping/app-data-center:latest
MARIADB_IMAGE=mooping/app-data-center-db:latest

MARIADB_PASSWORD=change_me_app_password
MARIADB_ROOT_PASSWORD=change_me_root_password
DB_DATA_PATH=./data/mariadb
JWT_SECRET=change-this-to-a-long-random-secret
```

โดยปกติไม่ต้องกำหนด `DATABASE_URL` เอง เพราะ `docker-compose.yml` จะประกอบให้จาก
`MARIADB_USER`, `MARIADB_PASSWORD` และ `MARIADB_DATABASE`

ถ้า password มีอักขระพิเศษสำหรับ URL เช่น `@`, `#`, `/`, `?`, `:` ให้ URL-encode password
แล้วกำหนด `DATABASE_URL` เองใน `.env`

4. Pull และ start:

```bash
docker compose pull
docker compose up -d
```

5. เปิดเว็บ:

```text
http://localhost:3000
```

## Re-import Initial SQL

ถ้าเคยรันบนเครื่องนั้นแล้ว MariaDB จะไม่ import SQL ซ้ำ เพราะมีข้อมูลเดิมอยู่ใน `DB_DATA_PATH`
ถ้าต้องการเริ่มใหม่จาก SQL ตั้งต้น ให้หยุด container แล้วลบโฟลเดอร์ข้อมูล DB ก่อน:

```bash
docker compose down
rm -rf ./data/mariadb
docker compose pull
docker compose up -d
```

คำสั่งลบโฟลเดอร์ `./data/mariadb` จะลบข้อมูลฐานข้อมูลเดิมทั้งหมด ใช้เฉพาะเมื่อต้องการเริ่มใหม่จริง ๆ

## Publish Images

ใช้เมื่อแก้ code หรือ SQL ตั้งต้นแล้วต้อง build/push image ใหม่ขึ้น Docker Hub:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml build
docker compose -f docker-compose.yml -f docker-compose.build.yml push
```

ถ้าต้องการเปลี่ยนชื่อ image ให้แก้ใน `.env`:

```env
APP_IMAGE=your-dockerhub-name/app-data-center:latest
MARIADB_IMAGE=your-dockerhub-name/app-data-center-db:latest
```

## Data Persistence Guardrails

- `docker compose restart`, `docker restart app-data-center-db`, and `docker compose down` followed by `docker compose up -d` keep database data when `DB_DATA_PATH` still points to the same folder.
- Do not delete `./data/mariadb` and do not run `docker compose down -v` unless you intentionally want to reset the database.
- Baseline SQL in the database image is imported only when the MariaDB data directory is empty. It should not re-import during a normal Docker reboot.
- The app container runs `npx prisma migrate deploy` before `npm run start` so committed migrations are applied to the existing database without importing seed data.
- The Prisma seed script no longer recreates or reactivates sample assets. User-deleted asset rows should not return after a seed run or Docker restart.

## Notes

- เครื่องปลายทางต้องมีแค่ `docker-compose.yml` และ `.env` ก็ pull/start ได้
- ข้อมูล DB ถูก mount ไว้ที่ `DB_DATA_PATH` จึงไม่หายเวลา recreate container หรืออัปเดต image
- ไม่ต้อง mount `docker/mariadb/init` บนเครื่องปลายทางแล้ว เพราะ SQL อยู่ใน DB image
- App ไม่รัน `prisma seed` ตอน start; ข้อมูลตั้งต้นมาจาก DB image
- ก่อนใช้งานจริงควรเปลี่ยน `MARIADB_PASSWORD`, `MARIADB_ROOT_PASSWORD` และ `JWT_SECRET`
