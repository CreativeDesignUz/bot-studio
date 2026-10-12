# Runtime-логирование ошибок
В `lib/observability/error-log.ts` реализован единый logger для серверных API.

Поля: `ts`, `level`, `event`, `error_id`, `operation`, `environment`, `error_type`, `code`. `error_id` — случайный UUID для поиска события в Cloudflare logs, а не идентификатор пользователя.

В логах **не должны** появляться: тело запроса, cookie, Telegram initData, токены, ключи, адреса и имена клиентов, SQL-запросы и внутренние стеки. Для продвинутой аналитики ошибок настраивается Cloudflare Workers Observability / Logs отдельно в аккаунте.

API возвращает безопасное сообщение клиенту; подробности остаются в защищённых Cloudflare logs. При расследовании указывать `error_id` и ID из `docs/ERROR_LOG.md`.

Проверка: `npm test`, CI ESLint/TS, чтение логов staging после тестовой ошибки. Журнал `docs/ERROR_LOG.md` — редакционный список известных проблем, он **не пополняется автоматически** каждым запросом.
