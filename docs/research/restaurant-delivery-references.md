# Restaurant delivery competitor references

Research date: 2026-10-09.

## 1. Yandex Eats

Useful patterns: menu import from Excel/Word/PDF, standard categories, category schedules, required weight or volume, ingredients, dietary badges, cooking method, age restrictions, preparation limits and menu validation.

Decision for Bot Studio: Excel import with validation; weight, ingredients, allergens, dietary tags and preparation time are first-class dish fields.

## 2. Wolt Merchant

Useful patterns: unified merchant portal for orders, sales, menus and hours; special hours; temporary item availability; restaurant-level pause during overload; role-based access.

Decision: show availability beside the menu, keep a one-tap stop-list action, and support scheduled categories and team roles.

## 3. Uber Eats Manager

Useful patterns: different menus by time of day, categories and sorting, photos, item-level hours, required and optional modifier groups, nested modifiers and conditional prices.

Decision: treat menus, categories, dishes and modifier groups as separate reusable entities.

## 4. DoorDash Merchant Portal

Useful patterns: mobile and desktop parity, item-level prep times, pickup and delivery prices, nested modifiers, temporary stock duration, substitutions, upsells and automated menu-quality recommendations.

Decision: add per-channel prices, timed stop-list, replacement flow and menu completeness score after the basic editor.

## 5. Deliverect

Useful patterns: product/modifier/combo/upsell/variant separation, category images, channel publishing, POS synchronization and explicit republish after structural changes.

Decision: keep one canonical menu and publish versions to Telegram, web and future iOS clients through channel adapters.

## MVP information architecture

- Restaurant profile: name, logo, description, cuisine, address, contacts, operating and special hours.
- Menu: one or more scheduled menus, categories, nested subcategories, dishes, variants, modifiers, combos and upsells.
- Dish: name, description, ingredients, allergens, photo, price, compare-at price, cost, weight/volume, calories, dietary tags, cooking method, preparation time, availability and order types.
- Orders: new, confirmed, preparing, ready, courier assigned, delivered, cancelled and refunded.
- Delivery: pickup/delivery, zones, fee, minimum order, ETA, courier mode and scheduled delivery.
- Revenue: payments, discounts, average check, product mix, repeat customers and campaign attribution.
