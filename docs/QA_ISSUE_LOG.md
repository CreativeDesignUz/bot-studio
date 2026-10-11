# Bot Studio — журнал ошибок и исправлений

> Внутренний журнал разработки. Для каждого нового дефекта создавайте GitHub Issue по шаблону `QA Bug Report`; сюда заносите подтверждённые инциденты и связь с исправлением. **Не включайте токены Telegram, персональные данные клиентов или секреты.**

Сводный архитектурный аудит, первопричины и план исправлений: [ARCHITECTURE_ISSUES.md](ARCHITECTURE_ISSUES.md).\n\n## Статусы
- **Открыта** — подтверждена, исправления пока нет.
- **В работе** — исправляется в отдельной ветке.
- **Исправлено в ветке** — код изменён, но ещё не доставлен в основную ветку.
- **Проверено CI** — соответствующая версия прошла автоматический CI; это НЕ означает успешное E2E.
- **Проверено E2E** — сценарий воспроизведён и исправление проверено на изолированном стенде.
- **Выпущено** — исправление внедрено в целевую среду (только после фактической проверки).
- **Повторно открыта** — дефект воспроизводится снова.

## История подтверждённых ошибок (11.10.2026)

| ID | Когда | Источник | Модуль | Ошибка / проявление | Серьёзность | Статус | Доказательство / исправление |
|---|---|---|---|---|---|---|---|
| QA-001 | 11.10.2026 | GitHub Actions / TypeScript | Mini App | `dark` использовалась до объявления | High (сборка блокируется) | Проверено CI | Run [38132985648](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38132985648), исправлено в `23ad3d0` |
| QA-002 | 11.10.2026 | GitHub Actions / TypeScript | Админка → Оформление Mini App | Ответы `response.json()` имели тип `unknown` | High (сборка блокируется) | Проверено CI | Run [38132985648](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38132985648), исправлено в `83d9051` |
| QA-003 | 11.10.2026 | GitHub Actions / ESLint | Mini App | Синхронный `setState` в эффекте восстановления темы | High (CI блокируется) | Проверено CI | Run [38133213263](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38133213263), исправлено в `92c1bce` |
| QA-004 | 11.10.2026 | Code review | Админка → Каталог | При создании товара выбранная валюта перезаписывалась на UZS | Medium | Проверено CI; E2E не проведён | Исправление находится в [PR #3](https://github.com/CreativeDesignUz/bot-studio/pull/3) |
| QA-005 | 11.10.2026 | Code review | Mini App → Telegram | На экране отрисовывалась собственная имитация системного заголовка Telegram | Medium | Проверено CI; E2E не проведён | Исправление `2e3d663` |
| QA-006 | 11.10.2026 | Code review | Каталог / публикация | Изменения активных товаров могут отображаться без публикации, хотя дизайн читает `published_snapshot` | High | **Открыта: требуется E2E и исправление** | `app/api/miniapp/route.ts` читает live `catalog_items`; не считать устранённым |
| QA-007 | 11.10.2026 | Code review | Заказ и доставка | Нет полной подтверждённой проверки тарифов и зон доставки | High | **Открыта: требуется разработка и E2E** | `app/api/miniapp/route.ts`, серверный RPC заказа |

### Проверка последнего исправления

GitHub Actions run [38133282051](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38133282051) на коммите `92c1bce` завершился **success** (CI). Это не доказывает работу Mini App в настоящем Telegram, синхронизацию каталога, платежи или сценарии в реальной БД.

### Правило регистрации

Для каждой ошибки фиксируем: ID, дату и окружение, кто обнаружил (CI / автоматический QA / ручная проверка / клиент), версию и бот-ID без персональных данных, шаги воспроизведения, ожидаемый и фактический результат, серьёзность, ссылку на скриншот/лог, ответственного, коммит/PR, результаты повторной проверки и дату выпуска.

**Не путать статус исправления:** изменение в PR не означает выпуск в `main` или production. Все перечисленные фиксы сейчас находятся в рабочем [черновом PR #3](https://github.com/CreativeDesignUz/bot-studio/pull/3).

### Как подключить будущего QA-бота

Каждый прогон Playwright сохраняет артефакты (скриншоты, trace, тестовый сценарий). При новом сбое QA-процесс создаёт GitHub Issue с меткой `source:qa-agent` и ссылкой на GitHub Actions. Повторные падения прикрепляются к существующему Issue вместо создания дублей. Для фиксации завершения нужно подтверждение тестом на целевом стенде и ссылка на PR; автоисправления production запрещены.

## Сквозной QA-аудит: создание → админка → публикация → покупатель (11.10.2026)

Тип проверки: **source audit + существующий CI**. Playwright, реальные Telegram-клиенты, тестовая БД и геолокация не запускались в этом аудите. Не помечать пункты как E2E passed.

| ID | Этап | Точное место | Наблюдение | Приоритет | Итог |
|---|---|---|---|---|---|
| QA-008 | Создание бота | `app/api/onboarding/route.ts`, POST, начальный разбор JSON | Некорректный JSON/null приводил к необработанному исключению; исправлена проверка тела запроса | P1 | Исправлено в ветке `9b5c089`, CI/E2E ещё не подтверждены |
| QA-009 | Категории | `app/api/catalog/categories/route.ts`, POST и DELETE, разбор JSON | `null` JSON приводил к ошибке доступа к полю; добавлена проверка объекта | P1 | Исправлено в ветке `e4f03eb`, CI ожидается |
| QA-010 | Связь админки с Mini App | `app/api/miniapp/route.ts`, GET, и миграция 0009 | Опубликованные блюда и категории должны читаться только из снимка версии | P0 | Исправление в ветке `82f5df4` + миграция `1720a63`, требуется SQL/E2E на staging |
| QA-011 | Карта доставки | `app/miniapp/page.tsx`, форма checkout; `app/api/miniapp/route.ts`, POST | В клиентском оформлении адрес вводится текстом, координаты/карта и серверная проверка зоны не реализованы в этом пути | P1 | Открыта, гео-E2E не проводился |
| QA-012 | Фото баннера | `app/workspace/miniapp-appearance.tsx`, поле imageUrl | Реализована HTTPS-ссылка вместо загрузки файла из устройства | P2 | Ограничение базового MVP, не считать реализованным |
| QA-013 | Визуальная проверка Telegram | `app/miniapp/page.tsx`, тема/хедер/нижняя панель | Требуются сравнение Food 01/02 Light/Dark, нижний sheet/expanded/fullscreen и Android/iOS/desktop; source-level не доказывает отсутствие перекрытий | P1 | Не проверено на реальных клиентах |

### Матрица обязательного E2E на staging (выполняется QA Agent, когда подключены тестовые учётные данные)

1. Создать бота типа «Доставка еды», переподключиться под владельцем, открыть админку.
2. Изменить имя/описание и подтвердить сохранение с повторным чтением из API.
3. Создать категорию, товар с ценой и изображением; проверить её в админке и отсутствие данных у второго ресторана.
4. В «Оформление Mini App» выбрать Food 01/02, цвета, light/dark/customer, баннер и внутреннюю/внешнюю CTA; сохранить.
5. **До публикации** проверить, что покупатель видит старую версию каталога и темы.
6. Опубликовать тестового бота и открыть Mini App из Telegram; проверить тексты/цены/изображения/CTA/тему.
7. Выполнить поиск, смену категорий, изменение количества, корзину, заказ pickup и заказ delivery; сравнить сумму и состав заказа в админке.
8. Повторить checkout с тем же requestKey; проверить отсутствие дублей; затем повторить с изменённой корзиной.
9. Проверить карту/выбор геопозиции, выход за зону, разные зоны и тарифы доставки — **ожидаемый FAIL до реализации карты**.
10. Прогнать 4 комбинации Food 01/02 × Light/Dark в узком и широком viewport. Нативный Telegram bottom sheet / full screen проверить отдельно на реальном клиенте.
11. Сохранить trace, screenshots и результаты в GitHub Actions. При сбое создать Issue по `QA Bug Report`, Telegram-уведомление подключать только после задания безопасного chat_id/token для staging.

**Отдельно:** проверка compile/lint/test/build означает только целостность сборки, не реальную работоспособность пользовательской цепочки.


### Дополнительные исправления

| ID | Этап | Точное место | Наблюдение | Приоритет | Итог |
|---|---|---|---|---|---|
| QA-014 | Создание/изменение товара | `app/api/catalog/route.ts`, POST и DELETE, разбор JSON | `null` или JSON-массив приводил к ошибке доступа к полям | P1 | Исправлено в `a89ff44`, source regression в `tests/api-invalid-payloads.test.ts`; CI/E2E ожидаются |

| QA-015 | Мобильная админка | `app/workspace/page.tsx`, мобильное меню разделов | Настройки «Оформление Mini App» были доступны только в десктопном боковом меню | P2 | Исправлено в `13564f6`, CI/E2E проверяется |

### Новое исправление P0 — снимок каталога и идемпотентность

Миграция `supabase/migrations/202610100009_published_catalog_snapshot.sql` включает каталог в атомарный snapshot публикации и использует опубликованные цены при создании заказа. При повторном request key с другим содержимым заказа происходит отказ (новый столбец `request_payload_hash`). Покупательский GET возвращает 503, если миграция не применена и снимок отсутствует, **поэтому включать новый API отдельно от миграции нельзя**. Обязательно проверить и раскатать синхронно на тестовом окружении прежде, чем делать merge/deploy.

Для старых опубликованных ботов миграция один раз копирует текущее меню в snapshot. Это неизбежная оговорка: прежняя система не хранила исторический каталог и не позволяет восстановить его задним числом. Тестовый стенд обязателен.

### Заказы: управление статусами (11.10.2026)
- `app/api/orders/route.ts`: PATCH проверяет владение ботом, корректный переход `new → confirmed → in_progress → ready → completed`, ожидаемый прежний статус, отвечает 409 при конкурентном изменении.
- `app/workspace/order-manager.tsx`: действия принятия, приготовления, готовности и завершения заказа, ошибки и индикация сохранения.
- `tests/order-status-transitions.test.ts`: регрессионные проверки.
- **Ограничения:** отмена заказа и восстановление остатков НЕ реализованы; пуши Telegram продавцу и карта доставки также НЕ реализованы. E2E с базой не выполнен.

## QA checkpoint: 2026-10-11 — delivery module and release readiness

- **Source review:** shared `delivery_zone` settings available to template types `store` and `delivery`, published into the buyer storefront through `published_snapshot.settings`. Migration 0012 contains SQL radius/fee validation. These are **code findings only**.
- **Bug QA-016 (map default):** buyer's map defaulted to Tashkent regardless of seller zone. Fixed via `DeliveryLocationPicker.initialCenter` and seller published `centerLat/centerLng`; regression test appended to `tests/delivery-map.test.ts`. CI was running when recorded.
- **Not executed:** end-to-end create bot → publish → address pin → charge delivery → order visible in admin; real Telegram iOS/Android; zone edge cases and concurrent checkout on real Supabase; Playwright visual QA; ZAP/PageSpeed.
- **Release BLOCKED:** migrations 0009–0012 have not been applied or verified on isolated staging, and dependent API must not be deployed separately from its database schema/RPC.
- **Follow-on QA:** test two tenants, both templates, same/reused requestKey, currency restrictions, fee total, radius boundary, sold-out items, history and seller changes after publish.


## 2026-10-11 — Auth, admin mobile and deployment verification

Environment: isolated Cloudflare Worker \`bot-studio-staging\`, Supabase testbase \`eslbcwopolrxoptcxqhp\`. Production Worker \`bot-studio\` and primary Supabase were not changed by these commits. **No secrets or personal data in this journal.**

| Incident | Reproduction/behavior | Fix in branch | Verification |
|---|---|---|---|
| QA-017 / [Issue #9](https://github.com/CreativeDesignUz/bot-studio/issues/9) | Mobile workspace with an existing bot hides "Создать ещё бота" in desktop-only sidebar | Added visible mobile header CTA to \`/onboarding\` in \`app/workspace/page.tsx\` — \`eada053\` | TypeScript/lint/unit/build passed; browser QA required on updated Worker |
| QA-018 / [Issue #10](https://github.com/CreativeDesignUz/bot-studio/issues/10) | \`GET /api/workspace\` returned HTTP 200 without signed owner session, because \`resolveAppUser\` created a guest by default | Default changed to \`allowGuest=false\` in \`lib/auth/app-user.ts\` — \`465c878\`; browser workspace redirects to \`/auth\` instead of showing a broken cabinet — \`eada053\`; onboarding browser auth check — \`b89c90a\`; signed account cookie and verified Telegram Mini App initData remain supported | Cloudflare browser observed \`{"error":"Войдите в аккаунт."}\` on staging after 2026-10-11 16:49 UTC upload. HTTP status/E2E must be checked by Playwright |
| QA-019 / [Issue #11](https://github.com/CreativeDesignUz/bot-studio/issues/11) | Google login disabled when testbase provider reports Google not configured | PKCE client code present; **no provider activation was performed** | BLOCKED until Google OAuth Web Client ID/Secret are configured in Supabase testbase and tested with a real account |
| QA-020 | Previous browser QA used selectors not matching real label/viewport and ran before code deploy | Fixed Playwright selectors; added authenticated onboarding mock plus unsigned API, login redirection and theme checks in \`e2e/staging.spec.ts\` — latest test commit \`ad5cd65\` | CI [38156909925](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38156909925) passed; QA [38156909929](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38156909929) initial attempt failed against pre-update Worker; **re-run attempt 2 triggered after latest staging upload** |

### Post-deployment E2E result (11 October 2026)
- **PASS:** GitHub Actions [staging QA run 38156909929, attempt 2](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38156909929) completed successfully after Cloudflare staging was updated: **41 passed, 0 failed, 1 intentionally skipped** (desktop/mobile Playwright).
- **PASS on staging:** mobile create action, blocked anonymous admin APIs, unauthenticated browser redirect, bot template onboarding with mocked writes, theme selection/save with mocked writes, Mini App preview/cart, Telegram OIDC start and safe invalid callback handling.
- **PASS code quality:** [run 38156909925](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38156909925) — TypeScript, ESLint, unit tests, production build.
- **Still unverified:** complete real Telegram login and owner session, real Google OAuth (provider is currently disabled), actual persisted creation/publishing/checkout and ownership across two real user sessions. Do not claim the entire business E2E is complete.
- **Revision provenance:** Cloudflare metadata identifies the deployed Worker version and time but not its exact Git commit; functional staging tests passed against the live Worker.

### Staging deployment observation
- 2026-10-11 16:49:52 UTC: Cloudflare Worker \`bot-studio-staging\` deployment \`da5cc430-0532-4be7-b0d4-f11086a8e4e5\`, Worker version \`08b570df-6c1a-48ce-8009-c94952a45e1f\`, 100% traffic, deployed through Wrangler.
- Cloudflare does **not** expose a Git SHA for this uploaded version in the Worker metadata. The deployed source commit therefore **cannot be certified by time alone**. Treat successful post-deploy HTTP + browser QA as functional evidence, not SHA provenance.
- Avoid running staging E2E immediately on GitHub push **before** deploying that commit: it creates misleading regression reports. Preferred sequence: CI → isolated staging deploy → verify deployed revision → Playwright + Telegram acceptance → journal status update.
- Sign-in via actual Telegram approval, Google approval, mobile browser and real order processing remain separate acceptance gates. Mocked E2E does not verify provider callbacks or actual database writes.

## QA-021 — Animated BotFather token verification (11.10.2026)

- **Request:** on onboarding step “Настройте бота” → “Подключение через BotFather” make the Verify button visibly show progress and success.
- **UI changes:** `app/onboarding/page.tsx` — `4befdaf`: idle **«Проверить»** → spinner **«Сохраняем…»** when creating draft → spinner **«Проверяем…»** during Telegram token inspection → green check **«Успешно»** only after confirmed API response. Verification success shows found bot name/username and retains separate `Подтвердить подключение` action. Network failures return to retryable state, never show false success. Token input clears after verification; concurrent/repeated clicks disabled. `9b72826`: explain why Verify is disabled until bot name is supplied.
- **Safety:** no secret/token in repo, mock fixtures or QA logs; full token submission remains through pre-existing protected endpoint only. Tests do **not** call a real Telegram bot.
- **Regression tests:** `e2e/staging.spec.ts` — `3f599bd`: deliberately delay BotFather inspect response and assert spinner/disabled controls, then success; separate rejected-token test asserts no fake success and retry. Desktop and mobile.
- **Status:** **Verified on Cloudflare staging:** [Browser QA run 38158850924](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38158850924) **45 passed, 0 failed, 1 skipped**. [CI run 38158850959](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38158850959) **success** (typecheck, lint, unit tests, production build). Latest staging deployment observed from Wrangler at **2026-10-11 17:14:58 UTC**; Worker metadata does not expose exact Git commit; use the live QA result for functional verification.
- **Not covered:** real Telegram BotFather token approval, actual publish/webhook or production rollout. Separate acceptance required.

## QA-022 — Duplicate wizard navigation / delayed Telegram connection status (11.10.2026)

- **Reported UX:** two separate "Назад" controls in the onboarding wizard; "В кабинет" was in the left stage sidebar instead of the top app header. Duplicate bottom "Отмена"/"Перейти в кабинет" were redundant with header navigation.
- **Fix:** `app/onboarding/page.tsx`, commit `e42de16`: one bottom Back button for stages 2–4, no Back on first stage; top-right header button `В кабинет` at all stages, pointing to `/workspace`; side panel now only shows wizard progress. Removed bottom cabinet/exit duplicates.
- **Telegram state:** testbase SQL confirms project `asal bot` + `PhotoStockerbot` is already `connected` with an active credential and connected channel; this does **not** prove Telegram runtime/webhook end-to-end delivery. Cloudflare reported POST /api/channels/telegram/token 502 responses alongside later successful requests.
- **Fix:** `app/onboarding/page.tsx`, commit `5a5c7cc`: when `connect` POST fails, request current channel state with protected `GET /api/channels/telegram/token?bot=…`. If connected, replace misleading error with confirmed success; otherwise preserve original failure. No token values logged or stored in QA notes. Does **not** eliminate all possible upstream 502 causes.
- **Regression coverage:** `e2e/staging.spec.ts`, commits `f573a1b` and `168c8e4`. Test one back control and header cabinet access on desktop/mobile; simulate lost connect POST response with server-confirmed connected GET and verify correct status.
- **Verification:** [Staging QA run 38159508092](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38159508092) **49 passed, 0 failed, 1 skipped**. [CI run 38159508131](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38159508131) **success** (typecheck, lint, tests, build). QA ran against live Cloudflare staging; production untouched.
- **Remaining:** diagnose the actual server-side sequence causing intermittent 502; verify real Telegram messages, webhook, publication and new bot creation beyond mocked E2E before production release.

## QA-023 — Five-step onboarding with Mini App design and interactive preview (11.10.2026)

- **User request:** insert `Дизайн Mini App` between `Настройка` and `Запуск`. Provide style selector, colors, light/dark/customer themes and an interactive preview. Wizard now shows five stages and proportional progress.
- **UI changes:** `app/onboarding/miniapp-design-step.tsx` (commit `e3b722b`) uses existing `MiniAppLivePreview` iframe and displays the actual draft Mini App for store and delivery templates, with `Food 01 / Food 02` choices, preset and custom HEX colors, light/dark/customer settings and initial theme when buyer chooses. Persists the design through existing owner-only `POST /api/miniapp/design`; completion remains blocked on HTTP/API errors. Does not publish design until deliberate bot publication.
- **Wizard integration:** `app/onboarding/page.tsx` (commit `6a3c342`) now has `Telegram → Шаблон → Настройка → Дизайн Mini App → Запуск`, with `Шаг X из 5`, design completion gate, and an option to revisit the saved design. For `service`/`course`, style variants are not falsely advertised: only base template is currently supported; advanced designer applies to delivery/store.
- **Hydration reliability:** `app/onboarding/page.tsx` (commit `612077b`) disables Next/Continue buttons during the initial SSR-to-React hydration window using `useSyncExternalStore`, avoiding a lost click before handlers are ready.
- **Test updates:** `tests/onboarding-four-step.test.ts` (commit `06ceabf`) checks the new five-step contract; `e2e/staging.spec.ts` (commit `35960d5`) verifies the full mocked user path including design POST payload and final Launch page for both delivery and store, on mobile and desktop.
- **Verification:** [GitHub CI run 38160475850](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38160475850) **success**, including TypeScript, ESLint, unit tests and build. [Cloudflare staging QA run 38160475828](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38160475828) **49 passed, 0 failed, 1 skipped**. This is browser verification with mocked onboarding writes, not a full Telegram production order.
- **Scope:** Cloudflare staging only. Real Google/Telegram approvals and actual live purchase/order were not executed. The existing published Mini App and production Worker remain untouched.

## QA-024 — Unified navigation, compact catalog editor and direct photo upload (11.10.2026)

### UX issues and corrections
1. **Premature design choice** — removed `Посмотреть 2 дизайна доставки еды` from step `Выберите шаблон` in `app/onboarding/page.tsx`. Food 01/Food 02 remain in the dedicated following `Дизайн Mini App` step. Commit `01cb0e3`.
2. **Inconsistent or missing navigation** — introduced `app/workspace/workspace-sidebar.tsx`, shared by `app/workspace/page.tsx` and `app/workspace/builder/page.tsx`. It derives business modules from `productTemplates` and shows complete business navigation plus Mini App/delivery settings and Telegram bot editor controls. `Создать бота` is the first CTA, **above** the bot selector. Editor fetches owned bot list for switching; selected module from editor links to `/workspace?bot=…&section=…`. Mobile cabinet/editor have side drawers; `Настройки доступа` uses a profile/user icon and links to `/workspace/account`. Commits `9abda14`, `266a298`, `a998463`, `7d2c426`, `3ef92ca`, `6b03ff9`.
3. **Oversized dish/product modal** — `app/workspace/catalog-manager.tsx` now has max height `min(85dvh,740px)`, a scrollable middle region with `overscroll-contain`, and fixed modal header/footer; save/error messaging is visible inside the modal. Commits `1edc32b`, `ace438d`.
4. **Photo previously required an external URL** — `POST /api/catalog/image` added with verified account + bot ownership, file type/size (JPG/PNG/WebP, up to 2 MB) and magic-header validation. Uses the existing Supabase testbase `bot-assets` bucket under owner/bot scoped random object keys, returns `imageUrl` to the editor. The catalog item uploader and Mini App banner both accept local files, show progress + preview, and use a collapsible optional HTTPS URL field. Commits `0e8613f`, `1edc32b`, `6126b1f`.
5. **Automated regression coverage** — `e2e/staging.spec.ts` tests complete navigation and mobile drawer, compact modal scrolling, upload UI → catalog save request containing uploaded URL, and rejection of anonymous upload. `tests/editor-contextual-nav.test.ts` updated for the shared component. Commits `4bf3b88`, `56efed8`, `5decfce`.

### Verification
- **CI PASS:** [38162513489](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38162513489): TypeScript, ESLint, unit tests and production build.
- **Staging Playwright QA PASS:** [38162513508](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38162513508): **53 passed, 0 failed, 1 skipped**, desktop and mobile.
- Latest reviewed Cloudflare staging Worker deployment: `2026-10-11T18:07:35.212152Z` through Wrangler, version `6cd3e9ca-b307-4171-9c1c-7d73fe923432` receiving 100% traffic. Cloudflare version metadata does not contain a Git SHA; the browser QA verified deployed behavior.
- **Storage compatibility:** testbase `storage.buckets.bot-assets` is public, allows JPG/PNG/WebP, and currently limits files to exactly 2,097,152 bytes (2 MiB); UI and API aligned in commits `0d9d947`, `f41b402`, `55c29a8` without changing bucket policy or quota.\n- **Limitations:** image upload E2E uses mocked successful storage writes; the real unsigned request is rejected. **An authenticated real-file upload to Supabase Storage was not executed** (avoid altering a user's catalog/bot without approval). Do not assert that full real Telegram business flows or Google sign-in were tested. No production Worker or primary Supabase changes were intentionally made.


## QA-025 — Delivery inputs: manual entry with km / сум suffix (11.10.2026)

- **User report:** browser native number spinner in delivery radius and delivery price; request free numerical typing and persistent unit labels at the right edge of each field.
- **UI:** `app/workspace/delivery-settings.tsx`: replaced both `<input type="number">` with `type="text"` plus `inputMode="decimal"` for radius and `inputMode="numeric"` for fee, displayed inside focusable outlined groups with noneditable right-side suffixes **км** and **сум**. Radius can use `7,5` or `7.5`; fee supports `15 000` and `15000` without spinner. Captured raw editable strings separately from numeric zone state, avoiding unwanted zero coercion during typing.
- **Backend:** existing `/api/delivery/settings` unchanged. Validate radius **0.1–100 km** and fee **0–1,000,000 UZS**, convert fee to stored `feeMinor=fee*100` only when saving; never write an incomplete value to the server.
- **Commits:** `7abb9b5` initial UI, `4ebe186` corrected input regex/spacing, `a1cb524` and `968ed4a` expanded browser regression coverage.
- **Verification:** [CI 38163019232](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38163019232) **success**, including TypeScript, ESLint, unit tests, production build. [Initial browser QA 38162857502](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38162857502) **53 passed / 2 failed / 1 skipped** due to incomplete-input test on an earlier staging deployment. [QA run 38163019225](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38163019225) **first attempt: targeted desktop+mobile delivery-input regression passed; 51 other tests passed, four unrelated navigation/login tests failed** (transient staging/browser behavior). **Second attempt:** 53 passed, 2 failed, 1 skipped. Both delivery-input tests still passed; the two remaining failures are browser auth/onboarding tests (not delivery inputs). Full-suite QA is **not green**; auth stability is tracked separately.
- **Rollout:** test Cloudflare staging only. Production untouched.


## QA-026 — Opt-in demo content with confirmation, food images, orders and admin notifications

- **Request:** add `Загрузить демо-данные` to catalog/menu, with no demo content unless explicitly clicked and confirmed. Add food photos, categories, catalog items, example orders and notifications.
- **UI** (`app/workspace/catalog-manager.tsx`): opt-in button only for **draft/unpublished** delivery/store bots. Confirmation modal enumerates the exact changes: **4 categories (Бургеры, Пицца, Салаты, Напитки), 8 food-photo items, 3 synthetic orders, 3 dashboard-only notifications**. `Да, загрузить демо` is disabled until the user checks acknowledgement; Cancel/close never calls the API. After import, button becomes `Убрать демо` with a separate destructive-action confirmation. Actual user-added data are neither overwritten nor deleted.
- **Backend and migration:** `supabase/migrations/20261011183200_opt_in_demo_content.sql` adds service-only RPCs `seed_bot_studio_demo_content` and `remove_bot_studio_demo_content` plus a private `bot_demo_notifications` table. A row lock and `bots.settings.demo_content` marker provide transaction-level atomicity/idempotence. `app/api/demo-content/route.ts` validates authenticated owner + exact confirmation token, and refuses published/active bots. `GET` exposes status and local-only notifications. Roles `anon/authenticated` cannot call seed/remove RPC directly; the API uses privileged server keys after checking ownership.
- **Photos:** image URLs use food photographs hosted on `images.unsplash.com` (burgers, pizzas, salads, drinks), not generated placeholder text. External image delivery depends on the image host remaining reachable; these photos are for demo only.
- **Orders:** `orders.payload.is_demo=true`; `app/api/orders/route.ts` includes that marker and refuses status updates to demo orders; `app/workspace/order-manager.tsx` labels each as `ДЕМО` and hides real fulfillment buttons. No actual Telegram users, payments, courier dispatches or external push/SMS are created. `app/workspace/demo-notifications.tsx` displays only local admin demo notifications in the bell dropdown with distinct `ДЕМО` labels.
- **Publication safety:** `app/api/publish/route.ts` refuses publication when demo content is present (HTTP 409). Users must first remove demo content; this protects customers from false catalog items. The cabinet displays a `ДЕМО-КОНТЕНТ` banner.
- **Database verification (staging testbase):** SQL transactional test created a **temporary synthetic bot** in a transaction, imported 8 items / 3 orders / 3 notifications, rejected duplicate import, then removed records, validated zero remaining demo items, and **ROLLED BACK**. No real bot/user records were changed by this validation. New migration was applied only to testbase `eslbcwopolrxoptcxqhp`; production DB untouched.
- **CI:** [38164449471](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38164449471) **success** (TypeScript, ESLint, tests and build).
- **Browser QA:** [38164449446](https://github.com/CreativeDesignUz/bot-studio/actions/runs/38164449446): **55 passed / 4 failed / 1 skipped** across desktop+mobile. Opt-in demo tests, import/cancel/undo/notifications/auth rejection **passed**. The four failures were unrelated staging browser-navigation/onboarding/preview tests; **full suite not green**. Do not claim end-to-end Telegram publication verified.
- **Deployment:** Cloudflare `bot-studio-staging` version `437e91ce-85f4-46d8-8df7-f9894d27bf64`, deployed 2026-10-11 18:36:09 UTC at 100%. Production Worker not updated.
