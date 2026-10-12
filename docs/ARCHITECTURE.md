# Bot Studio — карта системы
Последняя сверка: 2026-10-12. Владельцы изменений: разработка Bot Studio.

## Окружения (НЕ путать)
| Назначение | Supabase проект | Project ref | Cloudflare Worker |
| --- | --- | --- | --- |
| Production | **Bot Studio — Production** | `xpylzfdwudtaceysfcwd` | `bot-studio` (маршрут и привязки требуют проверки) |
| Тестирование | **Bot Studio — Staging** | `eslbcwopolrxoptcxqhp` | `bot-studio-staging`, `https://bot-studio-staging.slavnauz.workers.dev` |

Это **согласованная карта назначения окружений**, а не доказательство действующего подключения Cloudflare → конкретный Supabase. Адрес Supabase хранится в Cloudflare Secret `SUPABASE_URL` и скрыт при чтении через API. Проверить соответствие следует отдельной диагностикой / вручную через настройки окружений перед публикацией. Нельзя просто переносить production-ключ в staging и наоборот.

На 2026-10-12 оба Supabase проекта отвечали на read-only SQL-запросы. В Production: 4 бота, 27 записей `app_users`, 2 `catalog_items`, 0 заказов. В Staging: 10 ботов, 74 записи `app_users`, 19 `catalog_items`, 4 `customers`, 0 заказов. Числа — моментальный снимок, не норматив.

Не удалять проект или пустые таблицы только потому, что они пустые. Основной и тестовый проекты содержат данные. База Staging имеет дополнительную схему Telegram-учётных данных.

## Технологии (по package.json)
- **Web UI:** Next.js 16, React 19, TypeScript, Tailwind CSS 4; собственные компоненты + Radix UI / Base UI.
- **Runtime / hosting:** Cloudflare Workers, Vinext 1.0 beta, Vite и Wrangler.
- **Backend:** серверные Next API route handlers, TypeScript.
- **Database / auth:** Supabase (PostgreSQL 17, Supabase Auth, PostgREST), `@supabase/supabase-js`; миграции SQL.
- **Bot / Mini App:** Telegram Bot API, Telegram WebApp initData (требует криптографической проверки).
- **Quality:** GitHub Actions `.github/workflows/ci.yml`, npm test, ESLint, tsc, npm audit, production build.

## Карта каталогов
| Путь | Роль |
| --- | --- |
| `app/page.tsx` | главная точка входа / redirect |
| `app/login/`, `app/api/auth/` | веб-вход и сессия |
| `app/workspace/` | кабинет продавца, CRM, отчёты и редакторы |
| `app/onboarding/` | создание нового бота |
| `app/api/workspace/` | защищённый API продавца |
| `app/api/checkout/` | оформление покупательского заказа; пока не прошло реальное E2E |
| `app/api/channels/telegram/` | runtime / webhook Telegram |
| `lib/auth/` | идентификация и проверка пользователей |
| `lib/supabase/server.ts` | создание серверного клиента Supabase |
| `lib/telegram/`, `lib/channels/` | интеграции Telegram |
| `lib/product/` | бизнес-шаблоны и разделы |
| `lib/observability/` | единый безопасный журнал ошибок |
| `supabase/migrations/` | схема и эволюция PostgreSQL |
| `tests/` | автоматические тесты |
| `docs/` | решения, расследования, инструкции |
| `.github/workflows/` | CI и staging deploy |

## Подключение к базе
Файл `lib/supabase/server.ts` читает:
- `SUPABASE_URL`: URL проекта.
- `SUPABASE_PUBLISHABLE_KEY`: публичный ключ Supabase.
- `SUPABASE_SECRET_KEY`: привилегированный серверный ключ. **Никогда** не передавать в браузер, URL, лог или Git.
`lib/auth/app-user.ts` проверяет сессию; операции по заказам и персональным данным обязаны контролировать владельца бота.

Cloudflare Secret нельзя восстановить в исходном виде через dashboard после создания. Имена привязок — не подтверждение, что они валидны. При необходимости сравнивать ref проекта через доверенный защищённый способ и не логировать секреты.

## Выкладка
Изменения → feature branch и PR → GitHub CI → Cloudflare Staging + Supabase Staging → интеграционный заказ и регрессия → отдельно согласованный Production deploy.

**На момент написания:** PR #12 не слит в main. Cloudflare staging deploy из CI блокировался отсутствием GitHub Secrets `CLOUDFLARE_ACCOUNT_ID` и `CLOUDFLARE_API_TOKEN`; production не обновлён. Некоторые миграции checkout ещё не применены к реальным базам.

## Работа с ошибками
См. `docs/ERROR_LOG.md` (открытые проблемы) и `docs/OBSERVABILITY.md` (структура runtime-логов и правила). Каждая ошибка должна иметь ID, окружение, шаги воспроизведения, критичность, владельца и статус. Не хранить персональные данные и токены в этих файлах.
