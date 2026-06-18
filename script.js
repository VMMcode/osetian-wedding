// Блокируем скролл, пока не отыграет интро hero (видео + сборка контента)
const lockScroll = () =>
  document.documentElement.classList.add("is-scroll-locked");
const unlockScroll = () =>
  document.documentElement.classList.remove("is-scroll-locked");
lockScroll();
// Подстраховка: разблокируем не позже чем через 20с, что бы ни случилось
setTimeout(unlockScroll, 20000);

// --- Прелоадер: скрываем после полной загрузки страницы ---
(() => {
  const preloader = document.getElementById("preloader");

  const onReady = () => startHero();

  if (!preloader) {
    onReady();
    return;
  }

  const MIN_VISIBLE = 1400; // минимальное время показа, мс (чтобы не мигало)
  const start = performance.now();

  const hide = () => {
    const elapsed = performance.now() - start;
    const wait = Math.max(0, MIN_VISIBLE - elapsed);
    setTimeout(() => {
      preloader.classList.add("is-hidden");
      preloader.addEventListener(
        "transitionend",
        () => preloader.remove(),
        { once: true }
      );
      onReady();
    }, wait);
  };

  if (document.readyState === "complete") {
    hide();
  } else {
    window.addEventListener("load", hide, { once: true });
  }
})();

// --- Hero: видео -> печать растёт/крутится -> встаёт на место в контенте ---
function startHero() {
  const hero = document.getElementById("hero");
  const stage = document.getElementById("heroStage");
  const video = document.getElementById("heroVideo");
  const seal = document.getElementById("heroSeal");
  const emblem = document.getElementById("heroEmblem");
  if (!hero || !video) {
    unlockScroll();
    return;
  }

  // Увеличенный размер печати в центре (доля ширины колонки)
  const SEAL_GROW_FRAC = 0.62;

  // Старт печати берём из CSS-переменных (% от видимой колонки)
  const readFrac = (name) =>
    parseFloat(getComputedStyle(hero).getPropertyValue(name)) / 100;

  // Пересчёт позиций/масштабов под текущие размеры элементов
  const measure = () => {
    const v = stage.getBoundingClientRect();
    const e = emblem.getBoundingClientRect();
    const base = e.width || 80; // конечный (покойный) размер печати
    seal.style.setProperty("--seal-base", base + "px");

    const fx = readFrac("--seal-x");
    const fy = readFrac("--seal-y");
    const fw = readFrac("--seal-start-w");

    const startW = v.width * fw;
    const grownW = v.width * SEAL_GROW_FRAC;

    // 0 — на сургуче в кадре письма (% от колонки)
    hero.style.setProperty("--x0", v.left + v.width * fx + "px");
    hero.style.setProperty("--y0", v.top + v.height * fy + "px");
    seal.style.setProperty("--s0", startW / base);

    // 1 — центр экрана, увеличенная
    hero.style.setProperty("--x1", window.innerWidth / 2 + "px");
    hero.style.setProperty("--y1", window.innerHeight / 2 + "px");
    seal.style.setProperty("--s1", grownW / base);

    // 2 — место эмблемы в контенте
    hero.style.setProperty("--x2", e.left + e.width / 2 + "px");
    hero.style.setProperty("--y2", e.top + e.height / 2 + "px");
    seal.style.setProperty("--s2", 1);
  };

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const reveal = () => {
    if (hero.classList.contains("is-revealing")) return;
    measure();
    hero.classList.add("is-revealing");
  };

  const finish = () => {
    hero.classList.add("is-done");
    unlockScroll(); // контент hero на месте — разрешаем скролл
  };

  if (reduceMotion) {
    finish();
    hero.classList.add("is-revealing");
    return;
  }

  // Пока ждём окончания видео — держим позиции актуальными при ресайзе
  window.addEventListener("resize", () => {
    if (!hero.classList.contains("is-revealing")) measure();
  });

  // По окончании анимации печати — фиксируем финал
  if (seal) {
    seal.addEventListener("animationend", (e) => {
      if (e.animationName === "seal-fly") finish();
    });
  }

  // Раскрытие стартует, когда видео доиграло
  video.addEventListener("ended", reveal, { once: true });

  // Подстраховка: если видео не запустилось (autoplay заблокирован)
  const fallback = setTimeout(reveal, 12000);
  video.addEventListener("ended", () => clearTimeout(fallback), { once: true });

  video.currentTime = 0;
  const playPromise = video.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      clearTimeout(fallback);
      reveal();
    });
  }
}

// --- Музыка: кнопка на солнце + звуковые волны в такт музыке ---
(() => {
  const audio = document.getElementById("music");
  const btn = document.getElementById("musicToggle");
  const waveL = document.querySelector(".hero__wave--left");
  const waveR = document.querySelector(".hero__wave--right");
  if (!audio || !btn || !waveL || !waveR) return;

  const BARS_PER_SIDE = 14;

  // Создаём палочки в обеих группах
  const makeBars = (container) => {
    const arr = [];
    for (let i = 0; i < BARS_PER_SIDE; i++) {
      const s = document.createElement("span");
      container.appendChild(s);
      arr.push(s);
    }
    return arr;
  };
  const left = makeBars(waveL);
  const right = makeBars(waveR);

  // Спокойное состояние — мягкая статичная «волна»
  const idle = () => {
    for (let i = 0; i < BARS_PER_SIDE; i++) {
      const h = 14 + 8 * Math.abs(Math.sin(i * 1.2));
      left[BARS_PER_SIDE - 1 - i].style.height = h + "%";
      right[i].style.height = h + "%";
    }
  };
  idle();

  let ctx, analyser, data, raf;

  const setupGraph = () => {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    const source = ctx.createMediaElementSource(audio);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 64; // 32 частотных корзины
    analyser.smoothingTimeConstant = 0.8;
    data = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    analyser.connect(ctx.destination);
  };

  const render = () => {
    if (!analyser) return;
    analyser.getByteFrequencyData(data);
    for (let i = 0; i < BARS_PER_SIDE; i++) {
      const v = data[i + 2] / 255; // пропускаем самые низкие корзины
      const h = 8 + v * 92;
      // зеркалим: к солнцу — одинаковые корзины с обеих сторон
      left[BARS_PER_SIDE - 1 - i].style.height = h + "%";
      right[i].style.height = h + "%";
    }
    raf = requestAnimationFrame(render);
  };

  // ВАЖНО: audio.play() вызываем синхронно внутри жеста. Если ждать через
  // await (например, ctx.resume()), браузер теряет «пользовательский жест»
  // и блокирует воспроизведение — поэтому resume() запускаем без await.
  const startPlayback = () => {
    setupGraph();
    if (ctx && ctx.state === "suspended") ctx.resume();
    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  };

  // Состояние кнопки/волн синхронизируем по реальным событиям аудио
  audio.addEventListener("play", () => {
    btn.classList.add("is-playing");
    btn.setAttribute("aria-label", "Выключить музыку");
    cancelAnimationFrame(raf);
    render();
  });
  audio.addEventListener("pause", () => {
    btn.classList.remove("is-playing");
    btn.setAttribute("aria-label", "Включить музыку");
    cancelAnimationFrame(raf);
    idle();
  });

  btn.addEventListener("click", () => {
    if (audio.paused) startPlayback();
    else audio.pause();
  });

  // 1) Попытка автозапуска сразу (сработает, если браузер разрешает)
  startPlayback();

  // 2) Фолбэк: autoplay со звуком блокируется до первого жеста —
  //    стартуем при первом взаимодействии со страницей.
  const GESTURES = ["pointerdown", "touchstart", "keydown", "scroll"];
  const onFirstGesture = (e) => {
    if (e && e.target && e.target.closest && e.target.closest("#musicToggle"))
      return; // по самой кнопке — её собственный обработчик
    startPlayback();
    // снимаем слушатели только если воспроизведение реально пошло
    if (!audio.paused) {
      GESTURES.forEach((ev) => window.removeEventListener(ev, onFirstGesture));
    }
  };
  GESTURES.forEach((ev) =>
    window.addEventListener(ev, onFirstGesture, { passive: true })
  );
})();

// --- Отсчёт до свадьбы (counter-секция) ---
(() => {
  const grid = document.querySelector(".counter__grid");
  if (!grid) return;

  // Дата и время свадьбы: 7 августа 2026, 13:00 (месяц 0-индексный)
  const WEDDING = new Date(2026, 7, 7, 13, 0, 0);
  // Старт отсчёта — для заполнения кольца «дней»
  const START = new Date(2026, 5, 17, 0, 0, 0);
  const TOTAL_DAYS = Math.max(
    1,
    Math.round((WEDDING - START) / 86400000)
  );

  const items = {};
  grid.querySelectorAll(".counter__item").forEach((item) => {
    items[item.dataset.unit] = {
      num: item.querySelector(".counter__num"),
      label: item.querySelector(".counter__label"),
      ring: item.querySelector(".counter__progress"),
    };
  });

  const pad = (n) => String(n).padStart(2, "0");

  // Склонение единиц: [1, 2-4, 5-0]
  const plural = (n, forms) => {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
    return forms[2];
  };
  const FORMS = {
    days: ["день", "дня", "дней"],
    hours: ["час", "часа", "часов"],
    minutes: ["минута", "минуты", "минут"],
    seconds: ["секунда", "секунды", "секунд"],
  };

  // progress 0..1 -> сколько дуги показать (pathLength=100, dasharray=100)
  const setRing = (ring, progress) => {
    ring.style.strokeDashoffset = String(100 - progress * 100);
  };

  const set = (unit, value, ringProgress) => {
    const it = items[unit];
    if (!it) return;
    it.num.textContent = unit === "days" ? String(value) : pad(value);
    it.label.textContent = plural(value, FORMS[unit]);
    setRing(it.ring, ringProgress);
  };

  const tick = () => {
    const now = new Date();
    const diff = Math.max(0, WEDDING - now);
    const totalSec = Math.floor(diff / 1000);

    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor(totalSec / 3600) % 24;
    const minutes = Math.floor(totalSec / 60) % 60;
    const seconds = totalSec % 60;

    set("days", days, Math.min(days / TOTAL_DAYS, 1));
    set("hours", hours, hours / 24);
    set("minutes", minutes, minutes / 60);
    set("seconds", seconds, seconds / 60);
  };

  tick();
  setInterval(tick, 1000);
})();

// --- RSVP-форма (готова к интеграции с Telegram) ---
(() => {
  const form = document.getElementById("rsvpForm");
  if (!form) return;

  // Эндпоинт serverless-функции (тот же домен на Vercel).
  // Если фронт на другом хостинге — впиши абсолютный URL функции на Vercel.
  const RSVP_ENDPOINT = "/api/rsvp";

  const countEl = document.getElementById("guestCount");
  const guestInput = document.getElementById("guestInput");
  const status = document.getElementById("rsvpStatus");
  const submitBtn = form.querySelector(".form__submit");

  // Счётчик гостей
  const MIN = 1;
  const MAX = 20;
  let guests = 1;
  form.querySelectorAll(".form__step").forEach((btn) => {
    btn.addEventListener("click", () => {
      guests = Math.min(MAX, Math.max(MIN, guests + Number(btn.dataset.step)));
      countEl.textContent = guests;
      guestInput.value = guests;
    });
  });

  const setStatus = (msg, type) => {
    status.textContent = msg;
    status.classList.remove("is-error", "is-ok");
    if (type) status.classList.add(type);
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const name = (data.get("name") || "").toString().trim();
    const attendance = data.get("attendance");
    const drinks = data.getAll("drinks");

    if (!name) {
      setStatus("Пожалуйста, укажите имя и фамилию", "is-error");
      return;
    }
    if (!attendance) {
      setStatus("Отметьте, будете ли вы с нами", "is-error");
      return;
    }

    const payload = {
      name,
      attendance,
      guests: Number(guestInput.value),
      drinks,
      company: (data.get("company") || "").toString(), // honeypot
    };

    sendRSVP(payload);
  });

  // === Отправка ответа: serverless-функция шлёт в Telegram + Supabase ===
  async function sendRSVP(payload) {
    if (submitBtn) submitBtn.disabled = true;
    setStatus("Отправляем…");

    try {
      const res = await fetch(RSVP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("bad status " + res.status);

      form.reset();
      guests = 1;
      countEl.textContent = 1;
      guestInput.value = 1;
      setStatus("Спасибо! Ваш ответ получен.", "is-ok");
    } catch (err) {
      console.error("RSVP send failed:", err);
      setStatus("Не удалось отправить. Попробуйте ещё раз", "is-error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }
})();

// --- Финал: солнце садится за горы (запуск, когда оно появилось в кадре) ---
(() => {
  const footer = document.getElementById("footer");
  const sun = document.getElementById("footerSun");
  if (!footer || !sun) return;

  const start = () => footer.classList.add("is-setting");

  if (!("IntersectionObserver" in window)) {
    start();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // входим в кадр — запускаем закат; выходим — сбрасываем,
        // чтобы при следующем долистывании анимация проигралась заново
        if (entry.isIntersecting) {
          footer.classList.add("is-setting");
        } else {
          footer.classList.remove("is-setting");
        }
      });
    },
    // лёгкий отступ снизу — стартуем, когда солнце уже немного поднялось в кадр
    // (увеличишь -10% → позже; 0px → как только солнце коснулось низа экрана)
    { threshold: 0, rootMargin: "0px 0px -10% 0px" }
  );

  observer.observe(sun);
})();
