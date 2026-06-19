# Deploy with Docker

คู่มือนี้สำหรับนำโปรเจกต์ไปติดตั้งบนเครื่องอื่นด้วย Docker โดยใช้ข้อมูลตั้งต้นจากไฟล์ SQL ใน repo แทนการรัน seed ใหม่

## Files Used for Initial Database

- `docker/mariadb/init/01-schema.sql` โครงสร้างฐานข้อมูลจาก MariaDB ปัจจุบัน
- `docker/mariadb/init/02-baseline-data.sql` ข้อมูลตั้งต้น เช่น asset, category, checklist และ system setting

MariaDB จะ import ไฟล์ในโฟลเดอร์ `docker/mariadb/init` อัตโนมัติ เฉพาะตอนที่ volume `db_data` ยังว่างเท่านั้น

## Install on Another Machine

1. ติดตั้ง Docker และ Docker Compose
2. Clone repo นี้
3. แก้ค่ารหัสผ่านและ secret ใน `docker-compose.yml`
4. รันคำสั่ง:

```bash
docker compose up -d --build
```

5. เปิดเว็บ:

```text
http://localhost:3000
```

## Re-import Initial SQL

ถ้าเคยรันบนเครื่องนั้นแล้ว MariaDB จะไม่ import SQL ซ้ำ เพราะมี volume เดิมอยู่ ถ้าต้องการเริ่มใหม่จาก SQL ให้ล้าง volume ก่อน:

```bash
docker compose down -v
docker compose up -d --build
```

คำสั่ง `docker compose down -v` จะลบข้อมูลฐานข้อมูลเดิมทั้งหมด ใช้เฉพาะตอนต้องการเริ่มใหม่จริง ๆ

## Notes

- Startup ของ app ไม่รัน `prisma seed` แล้ว
- ข้อมูล audit log ไม่ถูกใส่ในไฟล์ baseline data
- ก่อนใช้งานจริงควรเปลี่ยน `MARIADB_PASSWORD`, `MARIADB_ROOT_PASSWORD`, `DATABASE_URL` และ `JWT_SECRET`
