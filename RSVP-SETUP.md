# RSVP → Telegram + Neon (Postgres)

Форма шлёт ответ гостя на serverless-функцию `api/rsvp.js` (Vercel),
которая параллельно отправляет сообщение в Telegram и пишет строку в базу Neon.
Все секреты — только в переменных окружения Vercel, на клиент не попадают.

## Что нужно сделать (3 шага)

### Шаг 1. Таблица в Neon
1. Neon Console → твой проект → слева **SQL Editor**.
2. Вставь содержимое `db/rsvp.sql` → **Run**. Появится таблица `rsvp`.
3. Возьми строку подключения: на welcome-экране (или Dashboard → **Connect**)
   нажми **Show password** и **Copy** — это `DATABASE_URL`
   (вида `postgresql://neondb_owner:ПАРОЛЬ@ep-...neon.tech/neondb?sslmode=require`).

### Шаг 2. Telegram
- Бот у **@BotFather** (`/newbot`) → токен → `TELEGRAM_BOT_TOKEN`.
- Напиши боту сообщение, узнай свой id у **@userinfobot** → `TELEGRAM_CHAT_ID`.

### Шаг 3. Vercel
1. https://vercel.com → **Add New… → Project** → импортируй репозиторий
   `VMMcode/osetian-wedding`. Framework Preset: **Other**.
2. **Settings → Environment Variables** (Production + Preview):

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | строка подключения Neon (с паролем) |
   | `TELEGRAM_BOT_TOKEN` | токен из BotFather |
   | `TELEGRAM_CHAT_ID` | id чата |

3. **Deploy**. Сайт откроется по адресу `https://<project>.vercel.app`.

## Проверка
Отправь тестовый ответ через форму **на домене Vercel** (не GitHub Pages —
там нет `/api`). Должно прийти сообщение в Telegram и появиться строка в Neon
(SQL Editor → `select * from rsvp order by created_at desc;`).

Логи при проблемах: Vercel → Deployment → Functions → `api/rsvp` → Logs.
