-- Таблица для ответов гостей (RSVP) в Neon.
-- Выполнить в Neon: Console -> проект -> SQL Editor -> вставить -> Run.

create table if not exists rsvp (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null,
  attendance  text not null,       -- "Да, буду" | "Возможно" | "Не смогу"
  guests      int  not null default 1,
  drinks      text not null default ''
);
