# Lenz 🚀

GraphQL-based ORM for MongoDB (Prisma 7.0 style)

## Features

- ✅ **GraphQL SDL Schema** - Define models using GraphQL syntax
- ✅ **TypeScript First** - Full type safety and autocompletion
- ✅ **MongoDB Native** - Leverage all MongoDB features
- ✅ **Prisma 7.0 Style** - Familiar configuration and client generation
- ✅ **Auto-generated Client** - Generate TypeScript client from GraphQL schema
- ✅ **Relations Support** - One-to-One, One-to-Many, Many-to-Many
- ✅ **Transactions** - ACID transactions with MongoDB

## Quick Start

### 1. Install Lenz

```bash
npm install lenz
```

### 2. Initialize your project

```bash
npx lenz init
```

This creates:

- `lenz/schema.graphql` - Your GraphQL schema
- `lenz/lenz.config.ts` - Configuration file
- `.env.example` - Environment variables template

### 3. Edit your schema

Edit `lenz/schema.graphql`:

```graphql
type User @model {
  id: ID! @id
  email: String! @unique
  name: String!
  posts: [Post!]! @relation(field: "authorId")
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type Post @model {
  id: ID! @id
  title: String!
  content: String
  author: User! @relation(field: "authorId")
  authorId: ID!
}
```

### 4. Generate the client

```bash
npx lenz generate
```

This generates the client in `generated/lenz/client`.

### 5. Use in your code

```typescript
import { LenzClient } from '../generated/lenz/client';

async function main() {
  const lenz = new LenzClient({
    url: process.env.MONGODB_URI,
    database: 'myapp'
  });

  await lenz.$connect();

  // Create a user
  const user = await lenz.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice',
      posts: {
        create: [
          { title: 'Hello World', content: 'My first post' }
        ]
      }
    },
    include: {
      posts: true
    }
  });

  // Query users
  const users = await lenz.user.findMany({
    where: {
      email: {
        contains: 'example'
      }
    }
  });

  await lenz.$disconnect();
}
```

## Configuration

### `lenz/lenz.config.ts`

```typescript
import 'dotenv/config'
import { defineConfig } from 'lenz/config'

export default defineConfig({
  schema: 'schema.graphql',
  migrations: {
    path: 'migrations',
  },
  datasource: {
    url: process.env.MONGODB_URI,
    database: process.env.MONGODB_DATABASE || 'myapp',
  },
  generate: {
    client: {
      output: '../generated/lenz/client',
      generator: 'lenz-client-js',
    },
  },
  log: ['query', 'info', 'warn', 'error'] as const,
  autoCreateCollections: true,
})
```

## GraphQL Directives

Lenz extends GraphQL with custom directives:

- `@model` - Marks a type as a database model
- `@id` - Marks a field as primary key (auto-generated ObjectId)
- `@unique` - Creates a unique index
- `@index` - Creates a regular index
- `@default(value: "...")` - Sets default value
- `@relation(field: "...")` - Defines relation field
- `@createdAt` - Auto-sets creation timestamp
- `@updatedAt` - Auto-updates timestamp

## Supported Field Types

- `String`
- `Int`
- `Float`
- `Boolean`
- `ID` (stored as String)
- `DateTime` (JavaScript Date)
- `Date` (JavaScript Date)
- `Json` (any JSON value)
- `ObjectId` (MongoDB ObjectId as string)

## CLI Commands

```bash
# Initialize project
npx lenz init

# Generate client
npx lenz generate

# Generate with custom config
npx lenz generate --config lenz/lenz.config.js

# Show help
npx lenz --help
```

## Structure After Generation

```
my-app/
├── lenz/
│   ├── schema.graphql          # Your GraphQL schema
│   └── lenz.config.ts          # Configuration
├── generated/
│   └── lenz/
│       └── client/             # Generated client
│           ├── index.ts        # Main export
│           ├── client.ts       # LenzClient class
│           ├── types.ts        # TypeScript types
│           ├── enums.ts        # Enum definitions
│           ├── runtime/        # Runtime utilities
│           └── models/         # Model delegates
└── .env                        # Environment variables
```

## Development

### Build

```bash
npm run build
```

### Watch mode

```bash
npm run dev
```

### Lint

```bash
npm run lint
```

### Format

```bash
npm run format
```

## License

MIT