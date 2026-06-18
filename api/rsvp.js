// Vercel Serverless Function: приём RSVP -> Telegram + Neon (Postgres).
// Секреты — в переменных окружения Vercel (на клиент не попадают):
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DATABASE_URL (строка подключения Neon)

const { neon } = require("@neondatabase/serverless");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Тело
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  body = body || {};

  // Honeypot: бот заполнил скрытое поле — тихо принимаем
  if (body.company) return res.status(200).json({ ok: true });

  // Нормализация
  const name = String(body.name || "").trim().slice(0, 100);
  const attendance = String(body.attendance || "").trim().slice(0, 50);
  let guests = parseInt(body.guests, 10);
  if (!Number.isFinite(guests) || guests < 1) guests = 1;
  if (guests > 50) guests = 50;
  const drinks = (
    Array.isArray(body.drinks)
      ? body.drinks.map((d) => String(d).slice(0, 60)).slice(0, 10)
      : []
  ).join(", ");

  if (!name || !attendance) {
    return res.status(400).json({ error: "name and attendance are required" });
  }

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DATABASE_URL } = process.env;

  // --- Telegram (с обработкой миграции группы -> супергруппы) ---
  const sendTelegram = async () => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error("telegram env missing");
    }
    const text =
      "🎉 Ура! Новый ответ от гостя 💌\n\n" +
      `🙋 Имя: ${name}\n` +
      `✨ Присутствие: ${attendance}\n` +
      `👥 Гостей: ${guests}\n` +
      `🥂 Напитки: ${drinks || "—"}\n\n` +
      "🐾 С любовью, Чивас";

    const post = async (chatId) => {
      const r = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        }
      );
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok && data.ok, data };
    };

    let { ok, data } = await post(TELEGRAM_CHAT_ID);

    // Если обычная группа стала супергруппой — Telegram вернёт новый id.
    // Дошлём туда (сообщение не потеряется) и подскажем новый id в логах.
    const migrateId =
      data && data.parameters && data.parameters.migrate_to_chat_id;
    if (!ok && migrateId) {
      console.error(
        "⚠️ Telegram: чат мигрировал в супергруппу. Обнови TELEGRAM_CHAT_ID на:",
        migrateId
      );
      ({ ok, data } = await post(migrateId));
    }

    if (!ok) throw new Error("telegram " + JSON.stringify(data));
  };

  // --- Neon (Postgres) ---
  const saveDb = async () => {
    if (!DATABASE_URL) throw new Error("database env missing");
    const sql = neon(DATABASE_URL);
    await sql`
      insert into rsvp (name, attendance, guests, drinks)
      values (${name}, ${attendance}, ${guests}, ${drinks})
    `;
  };

  // Параллельно в оба места
  const [tg, db] = await Promise.allSettled([sendTelegram(), saveDb()]);
  const okTg = tg.status === "fulfilled";
  const okDb = db.status === "fulfilled";

  if (!okTg) console.error("Telegram failed:", tg.reason);
  if (!okDb) console.error("Neon failed:", db.reason);

  if (!okTg && !okDb) {
    return res.status(502).json({ error: "delivery failed" });
  }

  return res.status(200).json({ ok: true, telegram: okTg, db: okDb });
};
