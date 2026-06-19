# Deploy with Docker

คู่มือนี้สำหรับนำโปรเจกต์ไปติดตั้งบนเครื่องอื่นด้วย Docker โดยใช้ข้อมูลตั้งต้นจากไฟล์ SQL ใน repo แทนการรัน seed ใหม่

## Files Used for Initial Database

- `docker/mariadb/init/01-schema.sql` โครงสร้างฐานข้อมูลจาก MariaDB ปัจจุบัน
- `docker/mariadb/init/02-baseline-data.sql` ข้อมูลตั้งต้น เช่น asset, category, checklist และ system setting

MariaDB จะ import ไฟล์ในโฟลเดอร์ `docker/mariadb/init` อัตโนมัติ เฉพาะตอนที่ volume `db_data` ยังว่างเท่านั้น

## Install on Another Machine

1. ติดตั้ง Docker และ Docker Compose
2. Clone repo นี้
3. สร้างไฟล์ `.env` จาก template แล้วแก้ค่าตามเครื่องปลายทาง:

```bash
cp .env.example .env
```

4. แก้ค่าใน `.env` อย่างน้อย `APP_IMAGE`, `MARIADB_PASSWORD`, `MARIADB_ROOT_PASSWORD`, `DATABASE_URL` และ `JWT_SECRET`
5. รันคำสั่ง:

```bash
docker compose pull
docker compose up -d
```

6. เปิดเว็บ:

```text
http://localhost:3000
```

## Re-import Initial SQL

ถ้าเคยรันบนเครื่องนั้นแล้ว MariaDB จะไม่ import SQL ซ้ำ เพราะมี volume เดิมอยู่ ถ้าต้องการเริ่มใหม่จาก SQL ให้ล้าง volume ก่อน:

```bash
docker compose down -v
docker compose pull
docker compose up -d
```

คำสั่ง `docker compose down -v` จะลบข้อมูลฐานข้อมูลเดิมทั้งหมด ใช้เฉพาะตอนต้องการเริ่มใหม่จริง ๆ

## Notes

- Startup ของ app ไม่รัน `prisma seed` แล้ว
- ข้อมูล audit log ไม่ถูกใส่ในไฟล์ baseline data
- App ใช้ค่า `APP_IMAGE` จาก `.env` จึงไม่ต้อง build ใหม่บนเครื่องปลายทาง
- ก่อนใช้งานจริงควรเปลี่ยน `MARIADB_PASSWORD`, `MARIADB_ROOT_PASSWORD`, `DATABASE_URL` และ `JWT_SECRET` ใน `.env`

## Publish App Image

ใช้เฉพาะตอนแก้โค้ดแล้วต้องการสร้าง image ใหม่และ push ขึ้น Docker Hub:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml build app
docker compose -f docker-compose.yml -f docker-compose.build.yml push app
```

ชื่อ image ที่ build/push มาจากค่า `APP_IMAGE` ใน `.env` เช่น:

```env
APP_IMAGE=your-dockerhub-name/app-data-center:latest
```
