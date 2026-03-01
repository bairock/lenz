# Lenz 🚀

GraphQL-based ORM for MongoDB (Prisma style)

## Features

- ✅ **GraphQL SDL Schema** - Define models using GraphQL syntax
- ✅ **TypeScript First** - Full type safety and autocompletion
- ✅ **MongoDB Native** - Leverage all MongoDB features
- ✅ **Prisma Style** - Familiar configuration and client generation
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
  posts: [Post!]! @relation(field: "postIds")
  postIds: [ID!]!
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
- `@relation(field: "...")` - Defines relation field (foreign key must be in the same model)
- `@createdAt` - Auto-sets creation timestamp
- `@updatedAt` - Auto-updates timestamp

## Relations

Lenz requires explicit foreign key fields for all relation types:

### One-to-Many / Many-to-One
A bidirectional relationship where one side has an array and the other has a single reference:

```graphql
type Author @model {
  id: ID! @id
  books: [Book!]! @relation(field: "bookIds")  # one-to-many side
  bookIds: [ID!]!                               # array of Book IDs in Author document
}

type Book @model {
  id: ID! @id
  author: Author! @relation(field: "authorId")  # many-to-one side
  authorId: ID!                                 # single Author ID in Book document
}
```

- **Author → Book (one-to-many):** Foreign key `bookIds` is an array of IDs in the Author document
- **Book → Author (many-to-one):** Foreign key `authorId` is a single ID in the Book document

### One-to-One (foreign key single ID in source model)
```graphql
type User @model {
  id: ID! @id
  profile: Profile @relation(field: "profileId")
  profileId: ID
}

type Profile @model {
  id: ID! @id
  user: User @relation(field: "userId")
  userId: ID
}
```

### Many-to-Many (ID arrays on both sides)
```graphql
type Post @model {
  id: ID! @id
  categories: [Category!]! @relation(field: "categoryIds")
  categoryIds: [ID!]!
}

type Category @model {
  id: ID! @id
  posts: [Post!]! @relation(field: "postIds")
  postIds: [ID!]!
}
```

**Important:** Foreign keys must always be in the **source model** (the model containing the `@relation` directive). Classic one-to-many patterns with foreign keys in target models will cause validation errors.

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