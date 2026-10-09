# Аудит текущего состояния Mini Bot Constructor

Дата аудита: 9 октября 2026 года
Проверенная ревизия: `089fb6fe9131554ba479915f188c30136f8da970` (`main`)
Публичное окружение: [bot-studio-uz.wittykrill2.chatgpt.site](https://bot-studio-uz.wittykrill2.chatgpt.site/)
Объём аудита: исходный код, SQL-миграции, конфигурация, статические проверки и безопасная проверка опубликованных GET-маршрутов. Данные, зависимости и структура базы не изменялись.

## 1. Резюме

Проект сейчас является **работающим техническим прототипом SaaS-кабинета с частично подключённым Supabase**, а не готовым Telegram Bot & Mini App Constructor.

Подтверждён реальный сценарий: веб-пользователь может пройти онбординг, создать запись бота в Supabase и добавить первый товар. В опубликованном окружении во время аудита отображались созданный бот `asal dokon`, товар `oooo` и цена `60 000 сум`. Публичные страницы и Supabase health endpoint отвечают HTTP 200.

Однако полный путь обрывается сразу после онбординга: ссылка с ID созданного бота открыла редактор, но редактор показал дефолтный `Osh Express`, а не сохранённые данные. В консоли опубликованного сайта одновременно фиксировались повторяющиеся ошибки Vinext RSC prefetch и `TypeError`. Поэтому сценарий «создать → настроить → опубликовать → открыть покупательский Mini App → оформить заказ» **не работает end-to-end**.

Главные выводы:

- Supabase-схема содержит хороший задел для трёх вертикалей: магазин, доставка еды, услуги.
- Реальные API пока покрывают только создание бота, первый каталоговый элемент, базовые метрики, черновик, логотип и попытку публикации.
- Большинство разделов кабинета визуально существуют, но показывают статические строки и не выполняют CRUD.
- Редактор ресторана целиком работает в памяти браузера и не сохраняет данные.
- Покупательского Mini App в репозитории нет; опубликованный Telegram-бот направляет покупателя в продавцовский `/workspace`.
- Существуют две параллельные архитектуры хранения: Supabase для нового multi-tenant пути и D1/R2 для старого singleton `/studio`. Это создаёт дублирование и критическую неоднозначность.
- Legacy API `/api/studio` и `/api/avatar` не имеют авторизации и позволяют менять общие данные.
- TypeScript-проверка не проходит, автоматических тестов и CI нет.
- Архитектура пока не готова к нескольким тысячам независимых предпринимателей без переработки изоляции, runtime-пути, очередей, публикации и наблюдаемости.

**Экспертная оценка общей production-готовности текущего MVP: 24%.** Это оценка функционального покрытия подтверждённых сценариев, а не доля написанного кода.

## 2. Правила присвоения статуса

| Статус | Критерий |
|---|---|
| **Работает** | Сценарий реализован, подключён к реальным данным и подтверждён кодом и/или безопасной live-проверкой. |
| **Частично** | Есть реальная часть сценария, но отсутствуют обязательные шаги, обработка ошибок или end-to-end подтверждение. |
| **Mock** | Экран или интеракция существуют, но используют статические данные, локальный React state либо не вызывают рабочий API. |
| **Не реализовано** | Нет интерфейса и рабочего backend-сценария. Наличие таблицы без логики не считается реализацией. |
| **Не удалось проверить** | Код присутствует, но для фактического подтверждения нужны Telegram update, BotFather/Managed Bots, платёжный провайдер или другое недоступное условие. |

## 3. Архитектура

### 3.1 Технологии

| Слой | Технологии | Подтверждение |
|---|---|---|
| Web UI / API | Next.js 16, React 19, TypeScript 5.9 | [package.json:29-35](./package.json#L29-L35) |
| Runtime / сборка | Vinext beta, Vite 8, Cloudflare Workers/Wrangler | [package.json:45-64](./package.json#L45-L64), [vite.config.ts:63-98](./vite.config.ts#L63-L98) |
| Стили | Tailwind CSS 4, собственный `globals.css`, Lucide icons | [package.json:28-40](./package.json#L28-L40) |
| Основная БД | Supabase/PostgreSQL, `@supabase/supabase-js` | [lib/supabase/server.ts:4-20](./lib/supabase/server.ts#L4-L20) |
| Legacy БД | Cloudflare D1 + Drizzle ORM | [db/schema.ts:1-17](./db/schema.ts#L1-L17), [.openai/hosting.json:1-4](./.openai/hosting.json#L1-L4) |
| Файлы | Supabase Storage для новых логотипов; R2 для legacy-аватара | [app/api/bots/logo/route.ts:20-25](./app/api/bots/logo/route.ts#L20-L25), [app/api/avatar/route.ts:5-6](./app/api/avatar/route.ts#L5-L6) |
| Telegram | Bot API, manager webhook, managed project-bot runtime | [lib/channels/telegram-api.ts:3-15](./lib/channels/telegram-api.ts#L3-L15) |
| Excel | SheetJS/XLSX, только клиентский ресторанный редактор | [app/workspace/restaurant/page.tsx:32-41](./app/workspace/restaurant/page.tsx#L32-L41) |

В `package.json` заявлен Node.js `>=22.13.0`, но текущее локальное окружение аудита содержит только Node 20.20.0 ([package.json:5-7](./package.json#L5-L7)).

### 3.2 Основные приложения и модули

```text
bot-studio/
├── app/
│   ├── page.tsx                         # публичная/демонстрационная главная
│   ├── onboarding/page.tsx              # 5-шаговое создание бота
│   ├── workspace/page.tsx               # кабинет продавца + адаптация под Telegram
│   ├── workspace/builder/page.tsx       # редактор профиля, цвета и кнопок
│   ├── workspace/restaurant/page.tsx    # UI редактора меню, сейчас in-memory
│   ├── studio/page.tsx                  # старый singleton-конструктор
│   └── api/
│       ├── onboarding/route.ts           # создание/обновление бота и первого item
│       ├── workspace/route.ts            # список ботов и простые метрики
│       ├── bots/draft/route.ts           # чтение/сохранение черновика
│       ├── bots/logo/route.ts            # логотип в Supabase Storage
│       ├── publish/route.ts              # статус active + конфигурация Telegram
│       ├── channels/telegram/            # manager и два runtime webhook
│       ├── studio/route.ts               # legacy D1 API без auth
│       └── avatar/route.ts               # legacy R2 API без auth
├── lib/
│   ├── auth/app-user.ts                  # Telegram initData или guest-cookie
│   ├── telegram/init-data.ts             # HMAC-проверка initData
│   ├── channels/                         # Telegram adapter/API
│   ├── product/templates.ts              # 3 статические бизнес-структуры
│   └── runtime/flow-engine.ts             # простой command → response legacy flow
├── db/
│   ├── schema.ts                         # legacy D1 schema
│   └── index.ts                          # Drizzle/D1 binding
├── supabase/migrations/                  # основная PostgreSQL multi-tenant schema
├── drizzle/                              # legacy D1 migrations
├── build/ и scripts/                    # Sites/Vinext/Worker инфраструктура
└── docs/                                 # проектные заметки и product spec
```

Отдельного iOS-приложения, Swift/SwiftUI-кода или Xcode-проекта в репозитории нет.

### 3.3 Фактические потоки данных

#### Новый SaaS-путь

```text
Browser или Telegram Manager Mini App
        ↓ fetch + guest cookie / Telegram initData
Next/Vinext API routes на Cloudflare Worker
        ↓ Supabase secret key (service role)
Supabase PostgreSQL + публичный Storage bucket
        ↓ publish/connect
Telegram Manager Bot API → Managed project bot webhook
```

- Web-авторизация — случайный 64-hex bearer cookie, хеш которого хранится в `app_users.web_session_hash`; срок cookie — один год ([lib/auth/app-user.ts:35-48](./lib/auth/app-user.ts#L35-L48)).
- Telegram Manager Mini App передаёт `initData`, сервер проверяет HMAC и возраст данных до 24 часов ([lib/telegram/init-data.ts:33-54](./lib/telegram/init-data.ts#L33-L54)).
- Все прикладные API создают privileged Supabase client с secret key ([lib/auth/app-user.ts:17-20](./lib/auth/app-user.ts#L17-L20)). RLS при таком доступе не является главным барьером; изоляция фактически зависит от ручных `.eq("owner_id", user.id)` в каждом endpoint.
- Токен управляемого бота не хранится в таблице: он запрашивается у Telegram методом `getManagedBotToken` перед вызовами Bot API ([lib/channels/telegram-api.ts:14-15](./lib/channels/telegram-api.ts#L14-L15)).

#### Legacy-путь

```text
/studio → /api/studio → D1 singleton bot_default
                       ↘ outbox_events (нет consumer)
/api/avatar → R2
```

Legacy-путь не связан с `app_users`, `owner_id` или Supabase-ботами. В коде прямо указано, что UI использует singleton profile ([db/schema.ts:6-8](./db/schema.ts#L6-L8)).

### 3.4 Что реализовано, а что является заготовкой

Реализовано как реальные Supabase-операции:

- guest/Telegram identity;
- создание бота и первого `catalog_item`;
- загрузка логотипа;
- owner-scoped список ботов;
- три простые метрики и последние три заказа;
- чтение/запись простого JSON-черновика;
- заготовка публикации в Telegram;
- запись Telegram customer/activity events.

Заготовки без полноценной прикладной логики:

- богатые таблицы магазина, склада, оплат, услуг, записей, поддержки, отзывов и ресторана;
- почти все кабинетные разделы;
- ресторанный импорт и редактор;
- D1 flows/outbox;
- каналы WhatsApp, Instagram, webchat;
- покупательский Mini App;
- дизайн-темы и версионирование публикаций.

## 4. Матрица функциональности

### 4.1 SaaS-платформа продавца

| Функция | Статус | Фактическое состояние и доказательство |
|---|---|---|
| Регистрация | **Не реализовано** | Нет формы регистрации, email/phone auth, OTP, восстановления или account linking. Web автоматически создаёт гостя по cookie. |
| Web-авторизация | **Частично** | Анонимный годовой cookie даёт устойчивую сессию ([app-user.ts:35-48](./lib/auth/app-user.ts#L35-L48)), но это не полноценный аккаунт и его нельзя восстановить на другом устройстве. |
| Telegram-авторизация продавца | **Частично** | HMAC-проверка и upsert пользователя реализованы ([app-user.ts:20-31](./lib/auth/app-user.ts#L20-L31)), но полноценный live-login в рамках аудита не выполнялся. |
| Создание проекта/бота | **Работает** | POST создаёт owner-scoped `bots` ([onboarding API:23-35](./app/api/onboarding/route.ts#L23-L35)); live-сценарий подтвердил создание `asal dokon`. |
| Название, описание, цвета, логотип | **Частично** | Текст и цвета сохраняются; логотип имеет отдельный API. В редакторе upload-input не подключён ([builder:24](./app/workspace/builder/page.tsx#L24)). |
| Выбор типа бизнеса | **Работает** | Три типа: доставка, магазин, услуги; выбор сохраняется ([onboarding:25-41](./app/onboarding/page.tsx#L25-L41), [API:23-34](./app/api/onboarding/route.ts#L23-L34)). |
| Выбор готового шаблона | **Mock** | Есть три статические карточки бизнес-типа, но нет галереи готовых функциональных/дизайн-шаблонов и их версий. |
| Настройка Mini App | **Частично** | Редактируются название, описание, основной цвет и подписи кнопок. Действия, секции и маршруты кнопок не редактируются ([builder:24-27](./app/workspace/builder/page.tsx#L24-L27)). |
| Управление товарами | **Частично** | Реально можно создать только первый generic `catalog_item` во время онбординга ([onboarding API:37-45](./app/api/onboarding/route.ts#L37-L45)). Полного CRUD нет. |
| Управление услугами | **Частично** | Первый item может иметь тип `service`, но расписание, сотрудники и записи не подключены к API/UI. |
| Ресторанное меню | **Mock** | Категории и блюда предзаполнены константами и меняются только в React state ([restaurant:11-28](./app/workspace/restaurant/page.tsx#L11-L28)). Импорт Excel не отправляется в backend ([restaurant:32-41](./app/workspace/restaurant/page.tsx#L32-L41)). |
| Заказы | **Частично** | Кабинет только читает агрегаты и последние заказы ([workspace API:13-20](./app/api/workspace/route.ts#L13-L20)); создания/изменения заказа нет. |
| Клиенты | **Частично** | Runtime upsert-ит Telegram-пользователя ([project runtime:19-21](./app/api/channels/telegram/project-runtime/route.ts#L19-L21)), но UI управления клиентами — статический. |
| Платежи | **Не реализовано** | Есть таблица `payments`, но нет провайдера, checkout, callback/webhook, подписи и reconciliation ([migration 0002:63-69](./supabase/migrations/202610090002_business_modules.sql#L63-L69)). |
| Доставка | **Не реализовано** | Есть таблицы/поля, но нет расчёта зоны, адресного сценария, курьера или статусов доставки. |
| Аналитика | **Частично** | Реальны три счётчика и последние три заказа. Раздел «Отчёты» показывает пустой шаблон; нет периодов, воронки, когорт и экспорта. |
| Переключение нескольких ботов | **Частично** | Selector меняет выбранного бота и метрики ([workspace:45-60](./app/workspace/page.tsx#L45-L60)); остальные бизнес-модули остаются mock. |
| Черновик | **Частично** | Один JSON-снимок перезаписывает `settings`; нет версий, optimistic locking или истории ([draft API:31-38](./app/api/bots/draft/route.ts#L31-L38)). |
| Публикация | **Частично** | API ставит `active`, пишет событие и пытается настроить Telegram ([publish:14-30](./app/api/publish/route.ts#L14-L30)). Операция неатомарна, нет job/status/retry/rollback. |

### 4.2 Telegram-бот

| Функция | Статус | Фактическое состояние и доказательство |
|---|---|---|
| Подключение через BotFather | **Не реализовано** | Традиционный безопасный ввод BotFather token отсутствует. Используется deep link Managed Bots `t.me/newbot/...` ([telegram adapter:9-20](./lib/channels/telegram.ts#L9-L20)). |
| Подключение Managed Bot | **Не удалось проверить** | Код pending channel и matching по username есть ([publish:32-37](./app/api/publish/route.ts#L32-L37), [manager webhook:86-107](./app/api/channels/telegram/manager-webhook/route.ts#L86-L107)), но новый бот в ходе аудита не создавался. |
| Manager webhook | **Частично** | Есть проверка secret header и команды `/start`, `/help`, `/create`, `/bots` ([manager webhook:43-80](./app/api/channels/telegram/manager-webhook/route.ts#L43-L80)); live Telegram update не проверялся. |
| Project webhook | **Частично** | Проверяется runtime secret, записывается клиент и событие, обрабатываются `/start` и fallback ([project runtime:7-31](./app/api/channels/telegram/project-runtime/route.ts#L7-L31)). Нет dedup update, rate limit и полноценного flow engine. |
| Открытие seller Mini App | **Частично** | Manager bot создаёт web_app кнопки на `/onboarding` и `/workspace` ([manager webhook:51-67](./app/api/channels/telegram/manager-webhook/route.ts#L51-L67)). |
| Открытие buyer Mini App | **Не реализовано** | Project bot направляет покупателя в seller `/workspace`, а не в витрину ([project runtime:23-29](./app/api/channels/telegram/project-runtime/route.ts#L23-L29)). |
| Команды проекта | **Частично** | `/start` и общий ответ реализованы; произвольные кнопки сохраняют `action`, но runtime не исполняет бизнес-действия. |
| Уведомления покупателю | **Не реализовано** | Нет сервиса уведомлений о заказе/оплате/доставке. |
| Уведомления продавцу | **Не реализовано** | Нет подписки продавца и доставки событий. |
| Новости/рассылки | **Mock** | Legacy API пишет `outbox_events`, но consumer/worker в репозитории отсутствует ([studio API:40](./app/api/studio/route.ts#L40), [D1 schema:67-76](./db/schema.ts#L67-L76)). |
| Другие каналы | **Не реализовано** | Registry разрешает только Telegram и бросает ошибку для остальных ([registry.ts:5-7](./lib/channels/registry.ts#L5-L7)). |

### 4.3 Покупательский Telegram Mini App

| Функция | Статус | Фактическое состояние |
|---|---|---|
| Telegram initData покупателя | **Не реализовано** | Общий verifier есть, но project bot открывает seller route; отдельной buyer session/tenant resolution нет. |
| Главная витрины | **Не реализовано** | Отдельного buyer route/component нет. |
| Каталог и поиск | **Не реализовано** | Seller mock-таблицы не являются покупательским каталогом. |
| Категории и фильтры | **Не реализовано** | Есть только локальные категории ресторанного админ-редактора. |
| Карточка товара | **Не реализовано** | Нет buyer UI/API. |
| Корзина | **Не реализовано** | Нет сущности cart, API и UI. |
| Оформление заказа | **Не реализовано** | Таблицы заказов есть, create-order endpoint отсутствует. |
| Оплата | **Не реализовано** | Нет провайдера и подтверждения транзакций. |
| Доставка | **Не реализовано** | Нет выбора адреса/зоны/времени. |
| Отслеживание заказов | **Не реализовано** | Нет buyer endpoint и экрана. |
| Избранное | **Не реализовано** | Нет таблицы, API и UI. |
| Отзывы | **Не реализовано** | Таблица `reviews` существует, но buyer flow/API/UI отсутствуют. |
| Профиль | **Не реализовано** | Нет buyer profile screen. |

### 4.4 Визуальный конструктор

| Функция | Статус | Фактическое состояние и доказательство |
|---|---|---|
| Галерея шаблонов | **Mock** | Три hardcoded business-type cards, не дизайн-галерея ([onboarding:25-41](./app/onboarding/page.tsx#L25-L41)). |
| Система дизайн-тем | **Не реализовано** | Нет модели theme/token preset. |
| Основной цвет | **Частично** | Редактируется, сохраняется и отображается в preview. |
| Дополнительный цвет | **Частично** | Есть в онбординге/БД, но builder его не редактирует. |
| Шрифты | **Не реализовано** | Нет выбора и хранения. |
| Настройка секций | **Не реализовано** | Пункты sidebar «Меню/Доставка/Оплата...» не имеют handlers ([builder:23](./app/workspace/builder/page.tsx#L23)). |
| Кнопки | **Частично** | Можно добавить, переименовать и удалить. Нельзя настроить действие или реально переставить drag-and-drop ([builder:25](./app/workspace/builder/page.tsx#L25)). |
| Предпросмотр | **Частично** | Визуально обновляется локально ([builder:27](./app/workspace/builder/page.tsx#L27)), но кнопки не исполняют клиентские сценарии. |
| Переключение дизайнов | **Не реализовано** | Нет. |
| Многоязычность | **Не реализовано** | `language_code` хранится, но i18n и локализованный контент отсутствуют. |
| Светлая/тёмная темы | **Не реализовано** | Зависимость `next-themes` установлена, функциональность не подключена. |
| Черновик и публикация | **Частично** | Есть save/publish вызовы, но нет версий, diff, rollback и независимого опубликованного snapshot. |

## 5. Проверенные пользовательские потоки

Ниже перечислены все шаги flow, просмотренные в рамках аудита, с общей оценкой состояния.

1. **Открытие публичного онбординга — удовлетворительно.** Маршрут доступен, форма рендерится, адаптивный интерфейс присутствует.
2. **Ввод названия, описания, цветов и выбор типа — удовлетворительно.** UI и локальный preview работают; три типа бизнеса зафиксированы в коде.
3. **Создание бота — работает.** Live-среда показала сохранённый `asal dokon`; API создаёт owner-scoped запись в Supabase.
4. **Добавление первого товара — работает в узком сценарии.** Live-среда показала сохранённый товар `oooo`; API вставляет generic `catalog_item`.
5. **Переход в редактор созданного бота — неудовлетворительно.** URL сохранил ID созданного бота, но редактор показал дефолтный `Osh Express`. Ошибка загрузки скрывается `.catch(() => undefined)` ([builder:16](./app/workspace/builder/page.tsx#L16)).
6. **Редактирование профиля и кнопок — частично.** Локальный preview меняется; реальное сохранение зависит от успешной загрузки owner-scoped bot ID.
7. **Кабинет и переключение ботов — частично.** Реальный список/метрики подключены, остальные разделы — mock.
8. **Редактор ресторанного меню — неудовлетворительно для боевого использования.** UI интерактивен, но обновления исчезают после reload и не используют созданные SQL-таблицы.
9. **Публикация — не удалось проверить end-to-end.** Код меняет БД и вызывает Telegram, но в аудите публикация не запускалась, чтобы не изменять проект/внешнее состояние.
10. **Manager bot → seller Mini App — не удалось проверить live.** Маршруты и команды есть в коде.
11. **Project bot → buyer Mini App — критически нездоров.** Вместо витрины открывается seller workspace, поэтому покупательский путь отсутствует.

Итог flow-аудита: **узкий web-onboarding сохраняет данные, но продуктовый цикл после создания не замкнут**.

## 6. База данных

### 6.1 Основные Supabase-сущности

| Область | Таблицы/поля | Оценка |
|---|---|---|
| Identity/tenancy | `app_users`, `bots.owner_id`, `bot_memberships` | Хороший каркас ролей; membership пока не используется API. |
| Каталог | `catalog_items`, `catalog_categories`, `product_variants` | Структура есть, CRUD почти отсутствует. |
| Склад | `inventory_locations`, `inventory_levels` | Только схема. |
| Заказы | `orders`, `order_items` | Читаются метрики, создание/fulfillment отсутствуют. |
| Клиенты | `customers` | Upsert из Telegram runtime и count; управления нет. |
| Платежи/скидки | `payments`, `discount_campaigns` | Только схема. |
| Услуги | `services`, `staff_members`, `staff_services`, `appointments` | Только схема. |
| Поддержка/отзывы | `support_tickets`, `reviews` | Только схема. |
| Ресторан | `restaurant_profiles`, `menus`, nested categories, modifier groups/options, import jobs, delivery settings | Детальная схема, но UI её не использует. |
| Telegram | `bot_channels`, `bot_events` | Частично используется. |

Связи строятся через `bot_id` с cascade delete. Базовые сущности и owner membership создаются триггером ([migration 0001:169-178](./supabase/migrations/202610090001_initial_bot_studio.sql#L169-L178)). Бизнес-таблицы перечислены в [migration 0002:13-130](./supabase/migrations/202610090002_business_modules.sql#L13-L130), ресторанные — в [migration 0003:1-59](./supabase/migrations/202610090003_restaurant_menu.sql#L1-L59).

### 6.2 Разделение предпринимателей

Положительные стороны:

- у всех основных Supabase-сущностей есть `bot_id`;
- `bots` имеют `owner_id`;
- есть owner/admin/editor/viewer membership;
- RLS включён для базовых и бизнес-таблиц ([migration 0001:128-167](./supabase/migrations/202610090001_initial_bot_studio.sql#L128-L167), [migration 0002:139-147](./supabase/migrations/202610090002_business_modules.sql#L139-L147)).

Проблемы:

- `current_app_user_id()` работает только через `auth_user_id = auth.uid()` ([migration 0001:137-140](./supabase/migrations/202610090001_initial_bot_studio.sql#L137-L140)); guest-cookie и Telegram upsert не устанавливают `auth_user_id`.
- Приложение использует service/secret key и тем самым обходит RLS. Реальная tenant isolation держится на ручных фильтрах endpoint-ов.
- `bot_memberships` и роли не используются в API: доступ везде проверяется только по `owner_id`.
- Legacy D1 singleton вообще не имеет tenant owner и не может безопасно обслуживать нескольких предпринимателей.

## 7. Безопасность

### 7.1 Что сделано правильно

- Telegram `initData` проверяется через двухступенчатый HMAC SHA-256, используется constant-time сравнение, проверяется `auth_date` ([init-data.ts:26-54](./lib/telegram/init-data.ts#L26-L54)).
- Manager webhook и project runtime проверяют Telegram secret header ([manager webhook:43-45](./app/api/channels/telegram/manager-webhook/route.ts#L43-L45), [project runtime:11-13](./app/api/channels/telegram/project-runtime/route.ts#L11-L13)).
- Bot token не сохраняется в прикладной БД; managed token получается по запросу.
- Большинство новых API ограничивают запрос `owner_id`.
- Логотип ограничен 2 МБ и списком MIME types ([logo API:3-11](./app/api/bots/logo/route.ts#L3-L11)).

### 7.2 Критические и высокие риски

1. **Критично: legacy mutations без авторизации.** `/api/studio` позволяет менять профиль, команды, новости и channel connection без проверки пользователя ([studio API:33-53](./app/api/studio/route.ts#L33-L53)). `/api/avatar` позволяет заменить общий avatar без auth ([avatar API:6](./app/api/avatar/route.ts#L6)).
2. **Критично: seller и buyer используют один route.** Опубликованный project bot открывает `/workspace`, который является админским кабинетом. Покупательская авторизация/витрина отсутствует.
3. **Высоко: service role обходит RLS.** Одна забытая `.eq(owner_id, ...)` в будущем создаст межтенантную утечку. RLS сейчас не служит вторым барьером для серверных запросов.
4. **Высоко: runtime secret хранится открытым JSON-полем `configuration.runtime_secret`** ([publish:21-29](./app/api/publish/route.ts#L21-L29)); предусмотренный `secret_reference` не используется.
5. **Высоко: публикация неатомарна.** Бот сначала становится `active` и получает event, затем выполняются внешние Telegram-вызовы. При сбое Telegram БД уже сообщает active ([publish:14-30](./app/api/publish/route.ts#L14-L30)).
6. **Высоко: платежная безопасность отсутствует.** Нет подписи webhook, idempotency key, проверки суммы/валюты, reconciliation и refund flow.
7. **Средне: публичный Storage bucket.** Все логотипы доступны по public URL ([migration 0005:1-11](./supabase/migrations/202610090005_bot_assets.sql#L1-L11)). Для публичных логотипов допустимо, но нельзя использовать этот bucket для приватных документов.
8. **Средне: upload доверяет клиентскому MIME type.** Magic bytes и декодирование изображения не проверяются.
9. **Средне: нет rate limiting, request size limits и Telegram update deduplication.** Повторы webhook могут создавать повторные events.
10. **Средне: guest account невосстановим.** Cookie является единственным bearer credential, не ротируется и живёт год.
11. **Средне: часть API возвращает raw database errors клиенту**, например [onboarding API:35-45](./app/api/onboarding/route.ts#L35-L45).
12. **Средне: ошибки Telegram конфигурации местами проглатываются**, например [manager webhook:55](./app/api/channels/telegram/manager-webhook/route.ts#L55).

Секретные значения, токены, ключи и пароли в отчёт намеренно не включены.

## 8. Качество архитектуры и кода

### 8.1 Дублирование и связность

- Две модели `bots`: PostgreSQL/Supabase multi-tenant и D1 singleton.
- Два Telegram runtime endpoint: Supabase project runtime и D1 legacy runtime.
- Два хранилища изображений: Supabase Storage и R2.
- Две модели команд: JSON `home_buttons` в Supabase и отдельная D1 `commands`.
- Продавцовский workspace одновременно позиционируется как Telegram Mini App, но также ошибочно используется как покупательский Mini App.

Это усложняет миграции, поддержку, тестирование и делает непонятным источник истины.

### 8.2 Жёстко прописанные и mock-данные

- Три demo bot-а и продающие подсказки находятся прямо в UI ([workspace:8-20](./app/workspace/page.tsx#L8-L20)).
- Не-overview модули рисуют четыре статические записи и даже заявляют, что они сохраняются в Supabase, хотя API нет ([workspace:92-94](./app/workspace/page.tsx#L92-L94)).
- Builder стартует с `Osh Express` и тремя hardcoded кнопками ([builder:10-13](./app/workspace/builder/page.tsx#L10-L13)).
- Ресторан стартует с hardcoded категориями и блюдами ([restaurant:11-24](./app/workspace/restaurant/page.tsx#L11-L24)).
- UI показывает «Готовность 78%» как константу ([builder:23](./app/workspace/builder/page.tsx#L23)).

### 8.3 Неработающие действия

- Глобальная кнопка «Добавить товар/блюдо/услугу» в workspace не имеет `onClick` ([workspace:71](./app/workspace/page.tsx#L71)).
- Поиск, bell, «Открыть все», growth CTA и большинство menu actions не подключены.
- Builder sidebar не переключает секции; upload логотипа не имеет обработчика.
- Grip icon не означает drag-and-drop: переупорядочивание отсутствует.
- Ресторанное фото не читается и не загружается ([restaurant:60](./app/workspace/restaurant/page.tsx#L60)).
- Excel import только добавляет строки в state; reload стирает результат.
- News outbox не имеет доставщика.

### 8.4 Потенциальные ошибки

- `onboarding` обновляет bot и затем отдельно вставляет item без транзакции: возможен промежуточный state.
- Повторный submit первого item создаёт дубликат; idempotency отсутствует.
- `priceMinor: Number(price) * 100` не валидирует NaN, диапазон, целое значение и валюту ([onboarding:105-110](./app/onboarding/page.tsx#L105-L110)).
- API допускает `course` в TypeScript payload, хотя migration 0002 ограничила templates тремя типами ([onboarding API:10-14](./app/api/onboarding/route.ts#L10-L14), [migration 0002:10-11](./supabase/migrations/202610090002_business_modules.sql#L10-L11)).
- Workspace выполняет четыре запроса на каждый bot (`1 + 4N` pattern) ([workspace API:12-20](./app/api/workspace/route.ts#L12-L20)).
- «Сегодня» считается по timezone Worker, а не предпринимателя.
- Telegram runtime запрашивает managed token почти на каждое сообщение, что добавляет сетевую задержку и зависимость.
- Нет publish version/snapshot: draft и live configuration не разделены.
- Нет outbox/retry для Telegram API и нет распределённой блокировки публикации.

### 8.5 Git и доставка

На момент аудита рабочее дерево было чистым до создания этого отчёта, но локальная `main` и `origin/main` разошлись: 10 коммитов есть только в `origin/main`, 15 — только локально. Следовательно, GitHub, локальный код и опубликованное Sites-окружение нельзя считать гарантированно одной ревизией без отдельной сверки.

Текущий hosting описан как Sites/Cloudflare bindings ([hosting.json:1-4](./.openai/hosting.json#L1-L4)), а не GitHub Pages. GitHub Pages сам по себе не может исполнять эти API routes, webhooks, D1/R2 bindings и secret-backed Supabase server calls.

## 9. Масштабирование до нескольких тысяч предпринимателей

**В текущем виде — нет, архитектура не готова к безопасной эксплуатации на несколько тысяч предпринимателей.** Это не утверждение о пропускной способности: нагрузочные тесты не проводились. Вывод основан на функциональных и архитектурных ограничениях.

Что можно сохранить:

- PostgreSQL/Supabase data model с `bot_id`;
- базовое membership/RLS направление;
- channel adapter abstraction;
- разделение manager bot и project bot webhook;
- хранение project bot token вне прикладной БД.

Что блокирует масштабирование:

- service-role доступ без системного tenant context;
- legacy singleton и публичные mutation API;
- `1 + 4N` dashboard queries;
- синхронная публикация без queue/job/state machine;
- внешний Telegram вызов в request path без retries/circuit breaker;
- отсутствие webhook idempotency;
- отсутствие buyer storefront;
- отсутствие payment state machine;
- отсутствие observability: structured logs, tracing, metrics, alerts;
- отсутствие тестов, CI и нагрузочных измерений;
- отсутствие quotas/rate limits per tenant;
- отсутствие стратегии cache/CDN для каталога и media;
- отсутствие версий draft/published и безопасного rollback.

Для масштабирования нужен один canonical Supabase data plane, server-side tenant context, отдельный buyer runtime, event/outbox workers, агрегированные запросы и измерения p95/p99, error rate, webhook latency и throughput. До таких измерений нельзя заявлять конкретную выдерживаемую нагрузку.

## 10. Результаты проверок

### 10.1 Автоматические проверки

| Проверка | Результат | Детали |
|---|---|---|
| Автотесты | **Не выполнялись: отсутствуют** | В `package.json` нет test script; test/spec файлов и CI workflow не найдено. |
| ESLint | **Прошёл с предупреждениями** | Exit 0; 5 предупреждений `@next/next/no-img-element` в onboarding и studio. |
| TypeScript | **Не прошёл** | `npx tsc --noEmit --incremental false`, exit 2. Ошибки в `app/studio/page.tsx:22`, `app/workspace/builder/page.tsx:16`, `app/workspace/page.tsx:41`. |
| Production build | **Не удалось проверить в корректном окружении** | Локально доступен только Node 20.20.0; проект требует Node >=22.13. Сборка остановилась на отсутствии `node:fs/promises.glob`. Зависимости не обновлялись и Node не устанавливался согласно ограничениям аудита. |
| Supabase health | **Работает** | Публичный `GET /api/health/supabase` вернул HTTP 200 и `ok/connected` состояние; endpoint вызывает `bot_studio_health()` ([health route:3-13](./app/api/health/supabase/route.ts#L3-L13)). |

TypeScript-ошибки относятся к типизации callback-ов после `response.json()` и означают, что strict typecheck проекта сейчас красный. Они находятся в тех же местах, где live-редактор не загрузил сохранённого бота.

### 10.2 Публичные маршруты

9 октября 2026 года безопасные GET-запросы дали:

| Маршрут | HTTP |
|---|---:|
| `/` | 200 |
| `/onboarding` | 200 |
| `/workspace` | 200 |
| `/workspace/builder` | 200 |
| `/workspace/restaurant` | 200 |
| `/studio` | 200 |
| `/api/health/supabase` | 200 |

HTTP 200 подтверждает доступность документа, но не готовность действий внутри него.

### 10.3 Live UI

Подтверждено:

- созданный бот и первый товар отображаются в финальном шаге онбординга;
- переход содержит реальный UUID bot-а;
- редактор по этому UUID показал дефолтные данные вместо созданного бота;
- в console опубликованного сайта присутствовали повторные Vinext RSC prefetch errors и `TypeError: ... is not a function`;
- UI публикуемого редактора визуально доступен, но его end-to-end связь с созданным проектом не подтверждена.

POST publish, Telegram bot creation, webhook reconfiguration и платежи намеренно не запускались: это изменило бы внешнее состояние, что запрещено рамками аудита.

## 11. Реально работающие сценарии

1. Открыть публичный onboarding.
2. Заполнить название, описание и два цвета.
3. Выбрать один из трёх типов бизнеса.
4. Создать owner-scoped запись бота в Supabase через guest web session.
5. Опционально загрузить логотип в публичный Supabase Storage.
6. Добавить первый generic товар/блюдо/услугу.
7. Получить список принадлежащих пользователю ботов.
8. Переключить выбранного бота в кабинете.
9. Прочитать реальные количества заказов за день, каталога, клиентов и последние три заказа.
10. Проверить Supabase health RPC.

Ограничение: пункты 1–6 подтверждают сохранение, но переход в корректно гидратированный редактор в live-среде не сработал.

## 12. Имитации и незавершённые функции

- весь buyer Mini App;
- каталог, карточка, корзина и checkout покупателя;
- платёжные провайдеры и подтверждение транзакций;
- доставка и трекинг;
- CRUD заказов/клиентов в кабинете;
- склад и варианты товаров;
- услуги, сотрудники, расписание и бронирование;
- поддержка, отзывы, отчёты, продажи и акции;
- ресторанное сохранение и реальный импорт;
- уведомления продавцу и покупателю;
- отправка новостей из outbox;
- дизайн-темы, шрифты, секции, тёмная тема, i18n;
- versioned drafts, publish snapshots и rollback;
- WhatsApp/Instagram/webchat;
- iOS-приложение;
- production observability и automated QA.

## 13. Что уже можно использовать

- как UX-прототип онбординга и кабинета;
- как основу Supabase domain model;
- для внутреннего демо создания проекта и первого item;
- как стартовую реализацию Telegram Manager commands;
- как основу визуального редактора названия/описания/основного цвета/кнопок;
- как основу для последующей реализации трёх вертикалей.

Использование должно быть ограничено внутренней командой и тестовыми данными.

## 14. Что нельзя выпускать в production

- legacy `/studio` и `/api/avatar` в публичном доступе;
- seller workspace как project bot Mini App для покупателей;
- платежи и заказы, поскольку end-to-end flow и транзакционная защита отсутствуют;
- ресторанный редактор, потому что данные не сохраняются;
- публикацию как надёжную операцию, потому что она неатомарна и не имеет retry/rollback;
- multi-tenant SaaS до устранения обхода RLS как единственной линии защиты;
- рассылки/уведомления, поскольку доставка не реализована;
- заявленную аналитику, кроме трёх простых фактических метрик;
- публичный запуск без исправления TypeScript, runtime ошибок и минимального test suite.

## 15. Приоритет переработки

1. **Зафиксировать источник истины.** Сверить GitHub, локальную ветку и deployed revision; выбрать один release branch и включить CI.
2. **Отключить или защитить legacy surface.** Закрыть `/studio`, `/api/studio`, `/api/avatar` авторизацией либо полностью вывести D1 singleton из runtime.
3. **Разделить seller и buyer продукты.** Создать отдельный публичный tenant-aware storefront route, например `/app/{botSlug}`, и никогда не открывать seller `/workspace` покупателю.
4. **Завершить identity model.** Supabase Auth/Telegram account linking, восстановление web account, роли membership, server-side tenant context.
5. **Сделать публикацию state machine.** Версии draft/published, transactional DB step, queue/outbox, idempotency, retries, status UI и rollback.
6. **Довести один вертикальный slice до конца.** Рекомендуется магазин: каталог → карточка → корзина → заказ → seller order list → уведомления. Только после этого переносить паттерн на delivery и services.
7. **Подключить платежи безопасно.** Provider adapter, signed webhook, idempotency, reconciliation, refund и audit trail.
8. **Подключить restaurant/service таблицы к реальному CRUD.** Убрать in-memory mock данные и обеспечить ownership checks.
9. **Перестроить dashboard queries.** SQL views/RPC агрегаты вместо `1 + 4N`; timezone предпринимателя; pagination.
10. **Добавить качество поставки.** Unit/integration/E2E tests, webhook contract tests, migration checks, lint + typecheck + build в CI.
11. **Добавить наблюдаемость и защиту.** Structured logs без секретов, tracing, alerts, rate limits, request limits, deduplication.
12. **После функционального ядра расширять builder.** Секции, theme tokens, fonts, dark mode, i18n, template gallery и design switching.

## 16. Оценка готовности крупных модулей

Методика: каждой обязательной функции из задания присвоен вес по значимости для завершённого пользовательского сценария. UI без данных получает не более 10% веса функции; таблица без API/UI — не более 5%; подтверждённый end-to-end шаг получает полный вес. Поэтому проценты не равны количеству файлов или экранов.

| Модуль | Готовность | Обоснование |
|---|---:|---|
| SaaS-платформа продавца | **34%** | Создание, первый item, bot switch и простые метрики реальны; большая часть CRUD, account auth, payments, delivery и analytics отсутствует. |
| Telegram manager/project bot | **31%** | Webhook и базовые команды написаны, но подключение не подтверждено, бизнес-команды и уведомления отсутствуют. |
| Покупательский Mini App | **3%** | Есть только общие таблицы и ссылки; отдельного интерфейса и commerce flow нет. |
| Визуальный конструктор | **27%** | Работают простые поля и preview; нет секций, действий, тем, версий, i18n и надёжной публикации. |
| База и domain model | **61%** | Схема охватывает основные сущности, связи и RLS, но большая часть не используется и tenant/auth модель не завершена. |
| Безопасность и эксплуатация | **29%** | HMAC и webhook secrets есть; legacy endpoints, service-role isolation, payments, rate limits и observability блокируют production. |
| Ресторанный модуль | **18%** | Богатый UI и SQL schema, но UI целиком in-memory и не связан с базой. |
| Услуги и запись | **8%** | Есть schema и static navigation, нет рабочего CRUD/booking flow. |
| iOS-приложение | **0%** | Код приложения отсутствует. |
| Общая production-готовность MVP | **24%** | Рабочий узкий onboarding не превращается в завершённый продающий Telegram-продукт. |

## 17. Финальный вывод

В проекте уже есть полезный фундамент: привлекательный onboarding, адаптивный кабинет, Supabase multi-tenant schema и набросок Telegram Managed Bots. Но текущая система остаётся набором частично связанных вертикальных заготовок. Основной коммерческий сценарий — покупатель открывает созданный Mini App, выбирает товар, оплачивает и создаёт заказ, а продавец управляет этим заказом — пока отсутствует.

Первый правильный технический шаг после аудита: **не добавлять новые экраны, а разделить seller workspace и buyer storefront, одновременно убрав публичный legacy singleton из production surface**. Это устранит главный архитектурный конфликт, после чего можно безопасно завершать один end-to-end бизнес-сценарий.
