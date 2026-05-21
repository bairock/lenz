# Lenz ORM — Правила проекта

## ВАЖНО: ВСЁ РЕАЛИЗОВАНО

**Все фичи Prisma, которые имеют смысл для MongoDB, уже реализованы в Lenz.**
Больше ничего добавлять не нужно. Не искать missing features, не сравнивать с Prisma, не предлагать новый функционал. Работаем только по конкретным задачам.

## Фундаментальные принципы

1. **Lenz — MongoDB-only ORM.** Мы работаем только с MongoDB. Никаких SQL-фич, никаких сравнений с SQL-возможностями Prisma. Если фича специфична для SQL (миграции, constraint enforcement, sequence, autoincrement, views, GIN/GIST индексы, savepoints, isolation levels) — она не нужна и не будет реализована.

2. **Prisma 7 не поддерживает MongoDB.** MongoDB будет только в Prisma 8 (Prisma Next). Сравнение с Prisma в контексте SQL не имеет смысла.

3. **Запрещено предлагать:** миграции, multi-DB поддержку, SQL-типы (Bytes/Decimal/BigInt), SQL-индексы, `autoincrement`, `$executeRaw`/`$queryRaw`, компиляцию запросов, Prisma Studio, интроспекцию, seed framework.

4. **Prisma $use() удалён.** В Prisma 6.14+ его нет. У нас есть `$extends` — это аналог Prisma Client Extensions, ничего делать не нужно.

## Архитектура

- **GraphQL SDL** — язык описания схемы
- **Парсинг** — `src/engine/GraphQLParser.ts`
- **Валидация** — `src/engine/SchemaValidator.ts`
- **Генерация кода** — `src/engine/generators/` (5 генераторов)
  - `TypeGenerator.ts` — типы TypeScript
  - `ClientGenerator.ts` — класс клиента
  - `DelegateGenerator.ts` — CRUD методы на модель
  - `DelegateRelations.ts` — включение связей
  - `DelegateHelpers.ts` — каскады, валидация
  - `RuntimeGenerator.ts` — рантайм модули
- **Рантайм** — `src/runtime/` (query, pagination, relations, errors, logger)

## Стиль кода

- ESM (import/export, .js расширения в импортах)
- TypeScript, строгая типизация
- camelCase для переменных, PascalCase для классов/типов
- Ошибки с осмысленными сообщениями, no `as any` без необходимости
- Template literals для генерации кода, аккуратно с отступами

## Особенности Lenz (не путать с Prisma)

Это НЕ gaps, это фичи Lenz, которых нет в Prisma:

- `@embedded` — встраиваемые документы MongoDB
- `@hide` — скрытие полей по умолчанию
- `@email`/`@url`/`@regex` — валидация на уровне схемы
- `@fulltext` — MongoDB text indexes
- Geo-spatial фильтры (near, geoWithin и т.д.)
- Атомарные операции с массивами (push/pull/addToSet/pop/pullAll)
- Две стратегии загрузки relation: populate + lookup (`$lookup`)
- 5 генераторов `@default`: uuid, now, cuid, cuid2, ulid
- `$raw` на каждом delegate
- **Bytes** — тип Buffer для бинарных данных
- **BigInt** — тип bigint (MongoDB Long)
