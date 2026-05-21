# Lenz ORM — LLM Context

GraphQL-based ORM for MongoDB (Prisma style). Code generation from GraphQL SDL → fully typed TypeScript client.

## Core Flow

```
schema.graphql (SDL + directives) → npx lenz generate → generated/lenz/client/ (TS client + runtime)
```

## Quick Start

```bash
npm install @bairock/lenz
npx lenz init        # creates lenz/schema.graphql, lenz/lenz.config.ts
# edit schema...
npx lenz generate    # generates client
```

```ts
import { LenzClient } from '../generated/lenz/client'

const lenz = new LenzClient({
  url: process.env.MONGODB_URI,
  database: 'myapp',
  log: ['query', 'info']
})
await lenz.$connect()

// CRUD
await lenz.user.create({ data: { email: 'a@b.com', name: 'Alice' } })
await lenz.user.findMany({ where: { email: { endsWith: 'b.com' } } })
await lenz.user.findUnique({ where: { id: '...' } })
await lenz.user.update({ where: { id: '...' }, data: { name: 'Bob' } })
await lenz.user.delete({ where: { id: '...' } })

// Relations
await lenz.user.findMany({ include: { posts: true } })

// Transactions (requires replica set)
await lenz.$transaction(async (tx) => {
  await lenz.user.update({ where: { id: '...' }, data: { name: 'Updated' } })
})

await lenz.$disconnect()
```

## Config (`lenz/lenz.config.ts`)

```ts
import 'dotenv/config'
import { defineConfig } from '@bairock/lenz'

export default defineConfig({
  schema: 'schema.graphql',
  datasource: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp',
  },
  generate: {
    client: {
      output: '../generated/lenz/client',
    },
  },
  log: ['query', 'info', 'warn', 'error'] as const,
  maxPoolSize: 10,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
```

## Schema Directives

| Directive | Location | Description |
|-----------|----------|-------------|
| `@model` | OBJECT | Marks type as database model |
| `@id` | FIELD | Primary key (auto ObjectId) |
| `@unique` | FIELD | Unique index |
| `@index` | FIELD | Regular index |
| `@default(value: "...")` | FIELD | Default value |
| `@relation(field, strategy?, index?, onDelete?)` | FIELD | Relationship definition |
| `@createdAt` | FIELD | Auto-set on create |
| `@updatedAt` | FIELD | Auto-update on modify |
| `@embedded` | OBJECT | Embedded document (no separate collection) |
| `@hide` | FIELD | Exclude from default query results |

## Supported Field Types

`String` → `string`, `Int`/`Float` → `number`, `Boolean` → `boolean`, `ID` → `string`, `DateTime`/`Date` → `Date`, `Json` → `any`, `ObjectId` → `string`

## Relations

Foreign keys must be in the **source model** (model containing `@relation`).

### One-to-Many / Many-to-One

```graphql
type Author @model {
  id: ID! @id
  books: [Book!]! @relation(field: "bookIds")   # oneToMany, auto: lookup
  bookIds: [ID!]!                                 # multikey index (auto)
}

type Book @model {
  id: ID! @id
  author: Author! @relation(field: "authorId")   # manyToOne, auto: populate
  authorId: ID!                                    # index (auto)
}
```

### One-to-One

```graphql
type User @model {
  id: ID! @id
  profile: Profile @relation(field: "profileId") # auto: populate
  profileId: ID                                    # sparse index (auto)
}
```

### Many-to-Many

```graphql
type Post @model {
  id: ID! @id
  categories: [Category!]! @relation(field: "categoryIds")  # auto: lookup
  categoryIds: [ID!]!                                         # multikey index
}
```

## Loading Strategies

| Type | Default | Description |
|------|---------|-------------|
| oneToOne | `populate` | Separate queries |
| manyToOne | `populate` | Separate queries |
| oneToMany | `lookup` | `$lookup` aggregation (server-side join) |
| manyToMany | `lookup` (ID array) / `populate` (join collection) | Depends on FK type |

Override: `@relation(field: "...", strategy: "populate")` or `"lookup"`

Lookup strategy requires manual ID array synchronization.

## Cascade Delete (`onDelete`)

| Value | Behavior |
|-------|----------|
| `NoAction` (default) | No cascade. Orphaned references. |
| `Cascade` | Delete related documents |
| `SetNull` | Set FK to null (nullable FK only) |

```graphql
type Author @model {
  posts: [Post!]! @relation(field: "postIds", onDelete: "Cascade")
  postIds: [ID!]!
  profile: Profile @relation(field: "profileId", onDelete: "SetNull")
  profileId: ID
}
```

SetNull validated — only allowed on optional FK fields (`ID`, not `ID!`).

## Client API

### `LenzClient(config)`

| Method | Description |
|--------|-------------|
| `$connect()` | Connect to MongoDB, auto-create collections + indexes |
| `$disconnect()` | Close connection |
| `$transaction(cb)` | ACID transaction (requires replica set) |
| `$supportsTransactions()` | Boolean check |
| `$isConnected()` | Boolean check |
| `$db` | Get MongoDB `Db` instance |
| `$mongo` | Get `{ client, ObjectId }` |

### Model Delegate (`lenz.user`, `lenz.post`, etc.)

| Method | Description |
|--------|-------------|
| `findUnique({ where })` | Single doc by unique field |
| `findMany({ where?, select?, include?, skip?, take?, orderBy?, cursor? })` | Query docs |
| `findFirst({ where?, ... })` | First matching doc |
| `create({ data, select?, include? })` | Insert one |
| `createMany({ data })` | Bulk insert → `{ count }` |
| `update({ where, data, select?, include? })` | findOneAndUpdate |
| `updateMany({ where?, data })` | Bulk update → `{ count }` |
| `upsert({ where, create, update, select?, include? })` | Upsert |
| `delete({ where, select?, include? })` | Delete one → doc or null |
| `deleteMany({ where? })` | Bulk delete → `{ count }` |
| `count({ where? })` | Count documents |
| `aggregate(pipeline)` | Raw MongoDB aggregation |
| `$raw` | Low-level: `{ collection, find, findOne, insertOne, updateOne, deleteOne, aggregate }` |

### Where Operators

`equals`, `not`, `in`, `notIn`, `lt`, `lte`, `gt`, `gte`, `contains` (case-insensitive regex), `startsWith`, `endsWith`, `AND`, `OR`, `NOT`

### Pagination

Offset: `{ skip: 40, take: 10 }` — standard skip/limit
Cursor: `{ take: 10, cursor: "...", skip: 1 }` — base64-encoded cursor (pass doc ID or cursor string)

### Atomic Operations

```ts
await lenz.post.updateMany({ data: { views: { increment: 1 } } })
```

Array operations: `push`, `pull`, `addToSet`, `pop`, `pullAll`, `pushAll` (with `$each` support)

## Generated Client Structure

```
generated/lenz/client/
├── index.ts          # Exports LenzClient + types
├── client.ts         # LenzClient class
├── types.ts          # Model types, CreateInput, UpdateInput, WhereInput, pagination types, LenzConfig
├── enums.ts          # Enum constants and types
├── runtime/
│   ├── query.ts      # QueryBuilder (where/select/buildUpdate/normalizeId)
│   ├── pagination.ts # PaginationHelper (cursor/offset pagination)
│   └── relations.ts  # RelationResolver (populate strategies)
├── models/
│   ├── index.ts
│   └── {Model}.ts    # One delegate per model
└── package.json      # dependency: mongodb ^6.0.0
```

## Transactions

Requires MongoDB replica set. `$transaction` accepts async callback with optional session argument.

```ts
await lenz.$transaction(async (tx) => {
  // tx is the session — operations within it are atomic
  await lenz.user.update({ where: { id: '1' }, data: { name: 'Updated' } })
  await lenz.post.create({ data: { title: 'Post', authorId: '1' } })
})
```

## CLI

| Command | Description |
|---------|-------------|
| `npx lenz init` | Scaffold project (schema, config, .env, .gitignore) |
| `npx lenz generate` | Generate client from schema |
| `npx lenz generate -c lenz/lenz.config.ts` | Custom config |
| `npx lenz --help` | Help |

## Important Notes

- Models without `@model` directive in schema are still parsed as models (all non-Query/Mutation/Subscription object types)
- Circular dependencies in relations are allowed (detection disabled)
- Lookup strategy requires manual array sync for ID arrays
- `@id` and `@unique` on same field causes validation error
- No cascading deletes by default — opt in with `onDelete`
- ESM package only (`"type": "module"`)
- Requires Node.js >= 18
