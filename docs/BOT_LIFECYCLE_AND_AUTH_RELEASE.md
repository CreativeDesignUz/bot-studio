# Bot Studio — вход, создание и привязка Telegram-ботов

Этот документ — контракт для разработки и релиза. Не путать три независимые операции:
1. **Вход продавца** через Google OAuth/Supabase PKCE или Telegram OIDC PKCE.
2. **Создание проекта** (строка `bots` в Supabase) — не создаёт Telegram-бота.
3. **Подключение Telegram-бота** через токен BotFather либо подтверждённый Managed Bot.

Официальные источники:
- https://core.telegram.org/bots/api — getMe, setWebhook, getWebhookInfo, deleteWebhook
- https://core.telegram.org/bots/telegram-login — Telegram OIDC, Allowed URLs, JWKS
- https://core.telegram.org/api/bots/managed-bots — создание через MTProto с участием пользователя
- https://core.telegram.org/bots/features — Bot Management Mode
- https://supabase.com/docs/guides/auth/social-login/auth-google — Google OAuth + PKCE
- https://supabase.com/docs/guides/auth/sessions/pkce-flow — одноразовый code verifier
- https://stackoverflow.com/questions/32537081/how-to-use-getupdates-after-setwebhook-in-telegram-bot-api — конфликт polling/webhook (не копировать чужие токены или примеры как секреты)

## Авторизация пользователя

**Google:** `/login` -> Supabase `signInWithOAuth(google)` с PKCE verifier в том же browser sessionStorage -> `/auth/callback` -> `exchangeCodeForSession` один раз -> сервер проверяет access token через Supabase Auth -> HttpOnly Secure Lax cookies (access + refresh) -> `/workspace`. Публичная Supabase callback URI должна быть разрешена в Google Cloud, а `https://<domain>/auth/callback` — в Supabase redirect allow-list. Не смешивать server-side verifier с browser-side без cookie-persisted обмена.

**Telegram:** `/api/auth/telegram/oidc/start` -> `https://oauth.telegram.org/auth` (code+PKCE+state) -> `/api/auth/telegram/oidc/callback` -> Basic-auth code exchange -> проверка JWKS, issuer, audience, expiry, sub -> подписанная HttpOnly cookie -> `/workspace`. В BotFather → Login Widget должны быть разрешены **именно те** origin и redirect URI, где выполняется вход. Login bot и пользовательские боты — отдельные сущности и токены.

**Сессии:** проверить anonymous 401, refreshed Google session, Telegram cookie, provider switch, logout, cross-user bot access. Не считать CI source checks браузерным E2E.

## Существующий бот через BotFather (MVP)

1. Продавец сохраняет свой проект. Сервер требует проверенную сессию и владельца проекта.
2. На странице настроек вводит BotFather HTTP API token. Никаких client-side логов и localStorage. Внешняя ссылка только https://t.me/BotFather.
3. Сервер проверяет формат и `getMe`. Токен действительный только если Telegram вернул `is_bot` и ID/username. `getMe` — не доказательство права собственности, но наличие рабочего токена даёт управление ботом.
4. Сервер шифрует AES-GCM, сохраняет credential в статусе pending с привязкой к userId/botId/external bot ID, сроком жизни 15 минут и запретом повторного использования в других проектах.
5. На подтверждении клиент отправляет **только** credentialId. Сервер заново расшифровывает, повторно проверяет `getMe`, `getWebhookInfo`, публичный HTTPS origin и разрешения.
6. Если активный webhook уже у **другого** сервиса/проекта, нельзя его заменять молча. Показать 409 и предложить сначала отключить старую интеграцию.
7. Сервер последовательно настраивает команды, описание, кнопку Mini App по адресу `/miniapp?bot=<uuid>`, `setWebhook` по адресу `/api/channels/telegram/project-runtime?channel=<uuid>` с `secret_token` и `drop_pending_updates=false`. После установки запрашивает `getWebhookInfo` и сравнивает URL.
8. Только после успеха сервер атомарно подтверждает credential в Supabase. При ошибке компенсация удаляет *только* webhook, поставленный нашим запросом, и не трогает webhook чужого сервиса.
9. Runtime защищён секретным заголовком `X-Telegram-Bot-Api-Secret-Token`. Подтверждение webhook ≠ гарантия доставки сообщений: отдельно проверить /start и получение обновления, затем Mini App / заказ.
10. Отключение не должно удалять чужой webhook, даже если его поменяли после нашего подключения.

## Шифрование и ротация

- `TELEGRAM_TOKEN_ENCRYPTION_KEY` и `TELEGRAM_TOKEN_ENCRYPTION_KEY_V2` — **secret_text** bindings Cloudflare. Каждый ключ — Base64/Base64URL ровно 32 случайных байта, не обычный пароль или Telegram-токен.
- Входящие секреты нельзя читать из API Cloudflare и нельзя считать корректными по наличию binding. `encryptionReady` проверяет формат на сервере; клиенту отдаёт только boolean.
- Для новых credentials используется первый **валидный** ключ (приоритет V2). Для старых ciphertext пробуем ключи по очереди без передачи значений в браузер.
- Никогда не перезаписывать и не удалять старый ключ до проверки расшифровки существующих active credentials и постепенной ротации. При проблеме с новым ключом — откат версии, а не перезапись старых ciphertext.
- В процессе релиза использовать отдельный Cloudflare preview/стенд и тестового BotFather-бота.

## Managed Bots — отдельный режим

Telegram разрешает запросить управляемого бота через `https://t.me/newbot/<manager_bot_username>/<suggested_username>?name=<name>`. **Согласие подтверждает сам пользователь Telegram**. Менеджер должен иметь Bot Management Mode, включённый через BotFather; сервис обязан проверить `can_manage_bots`.

*Не прикреплять* созданного managed bot к чужому проекту только по совпадению username: нужен pending request и однозначное подтверждение Telegram user ID владельца. Пользователь, вошедший только через Google, сначала должен безопасно связать Telegram-аккаунт либо использовать BotFather-токен. Текущий MVP не должен обещать автоматическое создание, если менеджер и идентификатор владельца не настроены.

## Обязательные проверки перед публикацией

- CI: TypeScript + lint + unit/regression + build + Wrangler dry-run.
- Read-only staging: HTTPS login, Google provider redirect readiness, Telegram OIDC start+state+PKCE cookie, Supabase readiness, anonymous 401.
- **Browser E2E (реальный пользователь):** Google first login/return, повторный вход, refresh, Telegram login, logout, switching providers.
- **Telegram E2E (тестовый бот):** создать проект → повторить запрос без дубля → inspect действительного токена → confirm → webhook URL + secret → /start → открыть Mini App → оформить тестовый заказ → disconnect. Проверить ошибочные/просроченные токены, отсутствие ключа, старый ключ и активный сторонний webhook.
- Версия staging должна однозначно соответствовать SHA GitHub; перед релизом backup версии Worker и rollback. QA НЕ считается пройденным только из-за зелёной сборки. Production — только после stage E2E.

## Известные блокеры на 2026-10-14

- Staging содержит Cloudflare bindings `TELEGRAM_TOKEN_ENCRYPTION_KEY` и `_V2`, но API не раскрывает их содержимое, поэтому наличие ≠ валидность.
- Совместимые исправления пока в stacked draft PR #16 (auth), #17 (shared workspace sidebar), #18 (Telegram + creation), а не в активном staging. Не смешивать факт прохождения CI с фактом деплоя.
- Доступный Supabase connector показывает другой проект, не применяйте его миграции к нему. Vercel-команда недоступна из текущей сессии (403), нельзя утверждать, что её preview запущен.
