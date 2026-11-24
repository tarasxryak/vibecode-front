# Как использовался ИИ

**Инструмент:** Claude Code (модель Claude Opus 5.5), 24 ноября 2026.

**Скиллы:**

- `frontend-design` (Anthropic) — план дизайна и прототип;
- `shadcn` (shadcn/ui) — выбор и настройка компонентов;
- `web-design-guidelines` (Vercel) — финальное ревью.

Скиллы `shadcn` и `web-design-guidelines` установлены через `npx skills add` и лежат в `.agents/skills`, версии зафиксированы в `skills-lock.json`.

Скилл `unslop` официального источника не имеет: `npx skills find unslop` нашёл только несколько малоизвестных форков. Их не ставили. Тексты интерфейса и README вычитаны вручную по тем же правилам: коротко, активный залог, конкретные ошибки с подсказкой, что делать.

## Промпты

### 1. Основной бриф (на всю работу)

> Lab 8 — GitHub Issues Report Viewer. Implement the project in this repository… initialize it with Next.js App Router, TypeScript, and shadcn/ui… A user selects a Monday, submits the form, and sees two tables, one grouped by issue type and one grouped by author… Create an AI-assisted prototype first… Require a valid date that falls on a Monday. Show loading feedback and prevent repeat submissions… Create a separate, importable n8n workflow named «Read weekly report»… Use Playwright to mock /api/report and verify…

Полный текст брифа лежит у автора. К брифу приложен экспорт workflow Lab 7.2 — по нему ИИ взял схему таблицы `lab72_weekly_stats` (`repository`, `week_start`, `stats_json`) и формат `stats_json` (`totals`, `byType.{bug,task,feature,other}`, `byAuthor[]`).

### 2. Прототип

ИИ работал по скиллу `frontend-design`: «сначала план — цвет, шрифт, раскладка, принципы; проверь план на шаблонность; потом код». План и решения записаны в [`prototype/README.md`](../prototype/README.md). Прототип показывает все шесть состояний, которые требует бриф.

### 3. Интерфейс

На основе прототипа и правил скилла `shadcn` (формы через `Field` + `FieldLabel`, пустое состояние через `Empty`, ошибки через `Alert`, загрузка через `Skeleton` и `Spinner`, только семантические цвета темы) ИИ сделал:

- форму с валидацией и защитой от повторной отправки;
- серверный маршрут `/api/report`, который проверяет ответ n8n;
- workflow `Read weekly report`.

### 4. Тесты

> Use Playwright to mock /api/report and verify: keyboard input and validation for an empty date and a date that is not a Monday; a visible loading state and exactly one request when the user submits again while a response is pending; an empty response, a server error, and a successful retry; the full flow from picking a date to seeing both populated tables.

ИИ добавил тесты сверх брифа:

- неполная дата;
- обрыв сети;
- неверный формат ответа;
- отчёт с нулями;
- ссылка `?week=`;
- контракт маршрута с заглушкой n8n;
- e2e на мобильном экране.

## Что исправлено после ревью сгенерированного

Ниже то, что ИИ нашёл, проверяя собственный результат: по скриншотам, падениям тестов и ревью по `web-design-guidelines`.

| # | Что было | Как нашли | Что сделали |
|---|---|---|---|
| 1 | `shadcn init` подключил незнакомый пакет `cn` вместо `clsx` + `tailwind-merge` | ревью зависимостей | проверили `package.json` и README пакета: это официальный `shadcn-ui/cn`, оставили |
| 2 | При неверном ответе сервера пользователь видел внутренний текст валидатора («report: нет repository или weekStart») | упал тест «ответ в неверном формате» | `ReportFormatError` теперь показывается как «Сервис отчётов вернул данные в неожиданном формате.» |
| 3 | Наведение на основную кнопку делало её фон прозрачным на 20% — белый текст терял контраст | скриншот | при наведении фон темнеет (`color-mix` с чёрным), а не светлеет |
| 4 | На экране 390px обе таблицы вылезали за край | мобильный скриншот | на телефоне: подписи столбцов под цветной точкой, уже отступы ячеек, метки `bug`/`task` скрыты, длинные логины обрезаются с `title` |
| 5 | Ошибка «17 ноября 2026 — вторник…» ужималась в ширину поля (15rem) и занимала три строки | десктопный скриншот | кнопка в одной строке с полем, ошибка и подсказка во всю ширину формы; так же в прототипе |
| 6 | С `focusableWhenDisabled` Base UI ставит `aria-disabled`, а не `disabled` — пропало визуальное «недоступно» у кнопки во время загрузки | скриншот загрузки | стили `aria-disabled:opacity-70 cursor-progress` |
| 7 | `Spinner` из shadcn объявляет себя `role="status" aria-label="Loading"` по-английски | ревью разметки | внутри кнопки спиннер скрыт от скринридеров, состояние озвучивает текст «Загружаем отчёт…» и отдельный `role="status"` |
| 8 | Тест Tab считал три остановки внутри поля даты — на деле их другое число | упал тест | тест жмёт Tab, пока фокус не уйдёт с поля, и проверяет, что следующей идёт кнопка |
| 9 | `getByRole("alert")` находил два элемента: Next.js добавляет пустой `role="alert"` для объявлений о навигации | упали тесты ошибок | хелпер `errorAlert()` фильтрует по тексту ошибки |
| 10 | В прототипе смена `#состояния` не меняла экран, все скриншоты прототипа были одинаковые | просмотр скриншотов | обработчик `hashchange` |
| 11 | Ревью по `web-design-guidelines`: `transition-all` у кнопки, нет `prefers-reduced-motion` для скелетона и спиннера, нет `autocomplete` у поля, логины и метки без `translate="no"`, состояние не отражено в URL | ревью | всё исправлено; неделя теперь в `?week=`, на это есть тест |
| 12 | В GitHub Actions упали 4 теста с вводом даты с клавиатуры: Chromium на Linux держит порядок сегментов ММ/ДД/ГГГГ даже при `locale: ru-RU`, и «16112026» превращалось в 2026-12-11 | первый прогон CI | хелпер `typeDate` печатает дату настоящими нажатиями клавиш и пробует порядки ДД.ММ.ГГГГ, ММ/ДД/ГГГГ и ГГГГ-ММ-ДД, пока поле не примет нужную дату; проверено локально в ru-RU и en-US |

Два правила из гайдлайнов осознанно не применены:

- **Title Case в заголовках.** В русском языке принят регистр предложения.
- **Skip link.** На странице нет навигации, форма идёт сразу после заголовка.

## Проверка, что тесты ловят поломки

Поведение ломали временно, потом возвращали исходный код (`cmp` с копией).

| Что сломали | Результат |
|---|---|
| Убрали проверку `pendingRef` (кнопка по-прежнему отключается) | тест «повторная отправка» упал: `Received + "2026-11-16"` — ушёл второй запрос после Enter в поле |
| Убрали и проверку, и отключение кнопки | тот же тест упал на `toBeDisabled` |
| Удалили заголовок и текст ошибки в `Alert` | упали 4 теста: ошибка сервера и повтор, нет сети, неверный формат, e2e «сбой n8n» |

После возврата кода все 22 теста снова проходят.
