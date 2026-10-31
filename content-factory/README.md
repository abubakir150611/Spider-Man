# AI Content Factory

Конвейер, который делает готовое видео по одной теме: исследование, сценарий, озвучка, монтаж, рендер, описание со ссылками и публикация в Telegram.

```
/create-video 5 полезных инструментов для веб-дизайна
/create-video YouTube long: Полный обзор возможностей Claude Code
/create-video Shorts: 5 лучших GitHub-репозиториев для разработчиков --lang en
/create-video Reels: Как создать собственного AI-агента, 30 сек
/create-video TikTok: Жасалма интеллект деген эмне --lang ky
```

## Как это устроено

| Этап | Кто делает | Результат |
|---|---|---|
| Разбор запроса | `cf new` | платформа, язык, длительность, размер кадра |
| Исследование | Claude Code (WebSearch/WebFetch, официальные источники) | `research/research.json` |
| Проверка ссылок | `cf links` | `research/link-check.json` |
| Сценарий | Claude Code по правилам `/create-video` | `scripts/script.json` |
| Проверка фактов | `cf validate`: каждая ссылка и команда в видео должна быть в исследовании | ошибки и предупреждения |
| Озвучка | edge-tts → piper → MMS → espeak-ng (бесплатные движки) | `voiceovers/` |
| Скриншоты сайтов | Playwright + Chromium | `assets/shots/` |
| Таймлайн и субтитры | по реальной длительности озвучки, тайминг по словам | `scripts/timeline.json`, `subtitles/*.srt/.vtt` |
| Музыка и SFX | собственный синтезатор (без авторских прав) или ваши треки | `assets/music.wav`, `assets/sfx.wav` |
| Монтаж | Remotion (React): кинетическая типографика, карточки, «запись экрана», терминал, караоке-субтитры, переходы | `renders/video-silent.mp4` |
| Сведение | FFmpeg: приглушение музыки под голос, громкость −14 LUFS | `renders/final.mp4` (H.264 + AAC) |
| QA | ffprobe и полное декодирование: кодеки, размер, FPS, длительность, битые кадры, тишина, чёрные кадры, громкость | `renders/validation.json` |
| Публикация | заголовок, описания, тезисы, хештеги, ссылки, команды, источники | `publications/` |
| Telegram | Bot API: видео, а следом пост со ссылками | `publications/telegram-result.json` |

Каждый этап кэшируется по хешу входных данных. Повторный `cf build` продолжает с места ошибки и ничего не пересобирает зря. Предыдущие проекты не удаляются.

### Форматы

| Платформа | Префикс в запросе | Кадр | Длительность по умолчанию |
|---|---|---|---|
| YouTube Shorts (по умолчанию) | `Shorts:` | 1080×1920, 9:16 | 45 с |
| Instagram Reels | `Reels:` | 1080×1920, 9:16 | 45 с |
| TikTok | `TikTok:` | 1080×1920, 9:16 | 45 с |
| YouTube | `YouTube long:` / `YouTube:` | 1920×1080, 16:9 | 8 мин |

Везде MP4, H.264 High, yuv420p, BT.709, 30 fps, AAC 48 кГц стерео, `+faststart`.

Флаги: `--lang ru|en|ky`, `--duration 45s|2m`, `--platform shorts|reels|tiktok|youtube`. Также понимаются «, 30 сек» и «(на английском)».

## Первоначальная настройка

### 1. Системные зависимости
- **Node.js ≥ 20.12** и **pnpm**
- **FFmpeg** (с ffprobe): `brew install ffmpeg` / `sudo apt install ffmpeg` / https://ffmpeg.org/download.html
- **Python 3.9+**

### 2. Установка — один раз, работает во всех проектах и сессиях
```bash
git clone --branch ccr-fdcc5adb-dun2m5 https://github.com/abubakir150611/Spider-Man.git
node Spider-Man/content-factory/install.mjs
```
(Когда ветка будет влита в `main`, флаг `--branch …` можно не указывать.)

Windows (PowerShell): сначала `winget install OpenJS.NodeJS.LTS Gyan.FFmpeg Python.Python.3.12`, откройте новый терминал, затем те же две команды.
Установщик:
- копирует фабрику в `~/.ai-content-factory` (другое место задаётся через `CF_HOME`);
- ставит npm-зависимости и `edge-tts`;
- создаёт команду `cf` в `~/.local/bin`;
- регистрирует **глобальную** команду Claude Code `/create-video` в `~/.claude/skills/create-video/`.

После перезапуска Claude Code команда доступна в любой папке и любом репозитории. Работает на macOS, Linux и Windows.

**Обновление** — тот же запуск: `git pull && node content-factory/install.mjs`. Код заменится, а `.env`, проекты, разрешение Telegram, скачанные голоса и ваша музыка останутся.

Секреты кладите в `~/.ai-content-factory/.env` (файл создаётся из `.env.example`). Подойдут и обычные переменные окружения: они имеют приоритет над `.env`.

Внутри этого репозитория команда работает и без глобальной установки (`.claude/skills/create-video`). Нужно только выполнить `pnpm install` в `content-factory/`.

При первом рендере Remotion сам скачает Chrome Headless Shell. Если Chrome уже установлен, укажите путь в `CF_BROWSER`.

### Облачные сессии Claude Code (claude.ai/code)
Облачный контейнер создаётся заново для каждой сессии, поэтому фабрику ставит setup-скрипт окружения.
1. Откройте меню окружения в заголовке сессии → **Edit**.
2. В **Setup script** добавьте:
   ```bash
   git clone --depth 1 --branch ccr-fdcc5adb-dun2m5 https://github.com/abubakir150611/Spider-Man.git /tmp/acf && node /tmp/acf/content-factory/install.mjs
   apt-get install -y espeak-ng >/dev/null 2>&1 || true   # необязательно: резервный голос
   ```
3. В **Environment variables** задайте:
   - `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHANNEL_ID`;
   - `CF_TELEGRAM_AUTO_PUBLISH=true`. Облако не сохраняет файл с разрешением между сессиями, поэтому разрешение задаётся переменной. Ставьте её после того, как один раз проверили подключение командой `cf telegram check`.
4. В **Network access** разрешите `api.telegram.org`, `speech.platform.bing.com` (озвучка), `opengraph.githubassets.com` и сайты, которые нужны для исследования. Либо выберите уровень доступа шире.
   Подробнее: https://code.claude.com/docs/en/cloud-environments

В облаке проекты лежат в `~/.ai-content-factory/projects`. В конце работы `/create-video` копирует видео и описания в `./video-output/` текущей рабочей папки (`cf export`) — оттуда их можно открыть в приложении.

Необязательно:
```bash
pip install -r requirements-offline.txt   # piper: офлайн-озвучка RU/EN
pip install -r requirements-kyrgyz.txt    # MMS-TTS: кыргызская озвучка (≈2 ГБ с PyTorch)
sudo apt install espeak-ng                # резервный движок (brew install espeak-ng)
```

### 3. Озвучка: что используется

| Язык | Порядок движков | Качество |
|---|---|---|
| Русский | edge-tts (`ru-RU-DmitryNeural`) → piper (`ru_RU-dmitri-medium`) → espeak-ng | нейросетевой, естественный |
| English | edge-tts (`en-US-AndrewNeural`) → piper (`en_US-ryan-high`) → espeak-ng | нейросетевой, естественный |
| Кыргызча | MMS-TTS (`facebook/mms-tts-kir`) → espeak-ng | приемлемый (MMS); espeak звучит роботизированно |

- **edge-tts** — бесплатные нейроголоса Microsoft Edge, без ключей и регистрации. Нужен интернет. Отдаёт тайминг каждого слова, поэтому субтитры совпадают с речью точно.
- **piper** работает офлайн. Голос скачивается один раз в `content-factory/.models/`.
- **MMS-TTS** — модель Meta. Лицензия CC-BY-NC 4.0, только некоммерческое использование. Для коммерческого кыргызского нужна другая модель или сервис, и это ваше решение.
- **espeak-ng** — последний резерв. Если сработал он, это помечается в `validation.json` (`tts.robotic: true`) и в отчёте.
- Голос можно сменить: `"voice": {"voice": "ru-RU-SvetlanaNeural"}` в script.json или `CF_EDGE_VOICE` в .env. Темп задаётся через `rate`, например `"+8%"`.
- Платные API (ElevenLabs и др.) не подключены и без вашего разрешения не используются.

### 4. Подключение Telegram-канала
1. В Telegram откройте **@BotFather**, отправьте `/newbot` и скопируйте токен.
2. Добавьте бота в канал **администратором** с правом «Публикация сообщений».
3. В `~/.ai-content-factory/.env` (или в `content-factory/.env` при работе внутри репозитория):
   ```
   TELEGRAM_BOT_TOKEN=123456789:AA...
   TELEGRAM_CHANNEL_ID=@your_channel     # для приватного канала числовой id: -100xxxxxxxxxx
   ```
   Числовой id приватного канала можно узнать, переслав пост из канала боту @userinfobot или @getidsbot.
4. Проверка: `node engine/bin/cf.mjs telegram check`. Будут показаны бот, канал и права.
5. Необязательно: `node engine/bin/cf.mjs telegram test` отправит тестовое сообщение.
6. Разрешение автопубликации (один раз): `node engine/bin/cf.mjs telegram approve`.
   `/create-video` спросит это разрешение сам перед первой публикацией. После этого готовые видео публикуются без вопросов. Отключить: `cf telegram revoke`.

**Как выглядит публикация:** видео с подписью (заголовок, краткое описание, хештеги), а ответом на него — пост: тезисы, инструменты с сайтами, GitHub, документацией и командами установки (`<code>`), источники, призыв подписаться. Длинный пост делится на сообщения по 4096 символов.

**Лимит размера:** обычный Bot API принимает файлы до 50 МБ. Если видео больше:
1. оно пережимается под лимит с сохранением разрешения;
2. если битрейт получается слишком низким, разрешение снижается до 720p;
3. если не помогает и это (очень длинное видео), оно делится на части, и все части отправляются ответами на первую.

Стратегия записывается в `telegram-result.json`. Для файлов до 2 ГБ можно поднять свой [Bot API server](https://github.com/tdlib/telegram-bot-api) и указать `TELEGRAM_API_BASE` и `TELEGRAM_MAX_UPLOAD_MB`.

**Безопасность:** токен хранится только в `.env`, а этот файл в `.gitignore`. В логах и ошибках токен заменяется на `[REDACTED]`, и URL с токеном никогда не выводятся.

## Запуск

Основной способ — в Claude Code:
```
/create-video <тема>
```

Вручную (после глобальной установки команда `cf` доступна везде):
```bash
CF=cf   # или: node ~/.ai-content-factory/engine/bin/cf.mjs
$CF new "Shorts: 5 AI-инструментов"   # создать проект, вывести id
# ... заполнить research.json, script.json, publication.json (см. templates/)
$CF validate <id>                     # проверка схем и фактов
$CF links <id>                        # проверка ссылок
$CF build <id>                        # собрать видео (--force: всё заново)
$CF publish <id>                      # опубликовать (--force: повторно)
$CF run <id>                          # build + publish
$CF export <id> [папка]               # скопировать видео и описания (по умолчанию ./video-output)
$CF list                              # все проекты
$CF status <id>                       # этапы проекта
$CF doctor                            # диагностика окружения
```
Вместо `<id>` можно указать его часть или `latest`.

## Структура

```
~/.ai-content-factory/  (в репозитории — content-factory/)
├── install.mjs                  установка/обновление, глобальная команда /create-video
├── skill/SKILL.md               шаблон команды /create-video
├── config/factory.config.json   платформы, голоса, громкость, лимиты (переопределения: config/local.config.json)
├── templates/                   шаблоны research/script/publication
├── assets/music/                ваши треки (необязательно)
├── engine/
│   ├── bin/cf.mjs               CLI
│   ├── lib/                     конвейер: TTS, таймлайн, субтитры, аудио, рендер, QA, публикации, Telegram
│   ├── tts/tts.py               воркер озвучки (edge-tts / piper / MMS / espeak-ng)
│   ├── remotion/                композиция и сцены (React)
│   └── test/                    тесты (node:test)
└── projects/<дата>-<тема>/      отдельная папка на каждое видео
    ├── research/                бриф, исследование, проверка ссылок
    ├── scripts/                 сценарий, таймлайн
    ├── voiceovers/              озвучка по сценам и общая дорожка
    ├── subtitles/               .srt, .vtt, captions.json
    ├── assets/                  скриншоты, музыка, SFX
    ├── renders/                 final.mp4, cover.jpg, validation.json
    ├── publications/            publication.md, описания, хештеги, пост для Telegram, результат публикации
    └── logs/pipeline.log
```
`projects/` не попадает в git (видео тяжёлые), но и не удаляется. Это локальный архив.

## Дизайн

Тёмная технологичная эстетика без шаблонных AI-эффектов: живой фон (дрейфующий свет, сетка, плёночное зерно, виньетка), шрифты Inter и JetBrains Mono, один акцентный цвет на видео (6 палитр). Типы сцен:

- **hook** — слова появляются по одному, ключевые выделены акцентом;
- **item** — номер, название, слоган, браузер с прокруткой реального скриншота сайта (или карточка GitHub), ссылки, команда;
- **code** — терминал, команда набирается в реальном времени, есть подсветка синтаксиса и звук клавиш;
- **stat** — анимированный счётчик;
- **bullets**, **fact**, **title** — списки, факты, заголовки глав;
- **outro** — кнопка подписки с анимацией.

Везде идут караоке-субтитры с подсветкой текущего слова, медленный наезд камеры и разные переходы (slide / zoom / wipe / blur) со звуком whoosh. В вертикальном формате субтитры и контент не заходят в зоны интерфейса TikTok и Reels. В горизонтальном выводятся названия глав.

Предпросмотр и правка дизайна: `pnpm studio` (Remotion Studio).

## Тесты
```bash
cd content-factory && pnpm test
```
Тесты используют только `node:test`, без лишних зависимостей. Покрыто:
- парсер запросов, субтитры, таймлайн;
- проверка фактов: выдуманные команды и ссылки отклоняются;
- форматирование публикаций;
- синтез звука и WAV;
- стратегии загрузки в Telegram: прямая, сжатие, деление на части;
- интеграция с mock-сервером Telegram Bot API: загрузка видео, лимиты 429, права бота, отсутствие токена в ошибках;
- сквозной прогон конвейера с настоящим рендером и повторным запуском.

## Лицензии
- **Remotion** бесплатен для частных лиц и компаний до 3 сотрудников. Для больших компаний нужна [лицензия](https://remotion.pro/license).
- Шрифты Inter и JetBrains Mono — SIL OFL 1.1 (пакеты @fontsource).
- Музыка и звуки синтезируются кодом, авторских прав третьих лиц нет.
