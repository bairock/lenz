# Lenz 🚀

GraphQL-based ORM for MongoDB (Prisma style)

## Features

- ✅ **GraphQL SDL Schema** - Define models using GraphQL syntax
- ✅ **TypeScript First** - Full type safety and autocompletion
- ✅ **MongoDB Native** - Leverage all MongoDB features including aggregation
- ✅ **Prisma Style** - Familiar configuration and client generation
- ✅ **Auto-generated Client** - Generate TypeScript client from GraphQL schema
- ✅ **Relations Support** - One-to-One, One-to-Many, Many-to-Many
- ✅ **Smart Loading Strategies** - Automatic choice between populate (separate queries) and lookup (server-side joins)
- ✅ **Automatic Indexing** - Intelligent index creation for foreign key fields
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

  # One-to-many relationship (auto-selects lookup strategy)
  posts: [Post!]! @relation(field: "postIds")
  postIds: [ID!]!  # Array automatically indexed

  # One-to-one relationship (auto-selects populate strategy)
  profile: Profile @relation(field: "profileId")
  profileId: ID  # Sparse index automatically created

  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type Post @model {
  id: ID! @id
  title: String!
  content: String

  # Many-to-one relationship (auto-selects populate strategy)
  author: User! @relation(field: "authorId")
  authorId: ID!  # Foreign key index automatically created

  # Many-to-many relationship (populate by default)
  categories: [Category!]! @relation(field: "categoryIds")
  categoryIds: [ID!]!  # Multikey index automatically created
}

type Profile @model {
  id: ID! @id
  bio: String
  user: User @relation(field: "userId", strategy: "populate")
  userId: ID
}

type Category @model {
  id: ID! @id
  name: String! @unique
  posts: [Post!]! @relation(field: "postIds", strategy: "lookup", index: false)
  postIds: [ID!]!  # No auto-index (index: false)
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
    database: 'myapp',
    log: ['query', 'info']  // Enable query logging
  });

  await lenz.$connect();

  // Create a user with posts (populate strategy for posts)
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
      posts: true,      // Uses populate strategy (separate queries)
      profile: true     // Uses populate strategy (one-to-one)
    }
  });

  // Query with include - automatic strategy selection
  const authorWithBooks = await lenz.author.findUnique({
    where: { id: 'some-author-id' },
    include: {
      books: true       // Uses lookup strategy (one-to-many, single query)
    }
  });

  // Manual array synchronization for lookup strategy
  // When creating a book, add its ID to author.bookIds
  const newBook = await lenz.book.create({
    data: {
      title: 'New Book',
      authorId: 'author-id'
    }
  });

  // Manually update the author's bookIds array
  await lenz.author.update({
    where: { id: 'author-id' },
    data: {
      bookIds: {
        push: newBook.id  // Add new book ID to array
      }
    }
  });

  // Complex query with filtering and sorting
  const posts = await lenz.post.findMany({
    where: {
      title: { contains: 'tutorial' },
      categories: {
        some: { name: { equals: 'Programming' } }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      author: true,      // populate strategy
      categories: true   // lookup strategy (if index: false, no auto-index)
    }
  });

  // Transaction example (requires replica set)
  await lenz.$transaction(async (tx) => {
    const updatedUser = await lenz.user.update({
      where: { id: user.id },
      data: { name: 'Alice Updated' }
    });

    await lenz.post.create({
      data: {
        title: 'Transaction Post',
        authorId: user.id
      }
    });
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
- `@relation(field: "...", strategy: "populate|lookup", index: true|false)` - Defines relation with loading strategy and index control
- `@createdAt` - Auto-sets creation timestamp
- `@updatedAt` - Auto-updates timestamp
- `@embedded` - Marks a type as embedded document
- `@hide` - Excludes field from query results by default

## Relations

Lenz implements MongoDB-native relations with explicit foreign key fields and intelligent loading strategies. Each relation type has an optimal default strategy for loading related data (see [Relation Loading Strategies](#relation-loading-strategies) for details).

**Key principles:**
- Foreign keys must be in the **source model** (the model containing `@relation`)
- Arrays are automatically initialized for required array fields
- Indexes are automatically created for foreign key fields (configurable)
- Loading strategy is automatically selected based on relation type

### Automatic Array Initialization

Required array fields (like `bookIds: [ID!]!`) are automatically initialized with empty arrays `[]` when creating documents. This prevents MongoDB `$in needs an array` errors when querying relations.

```typescript
// When creating a document, required arrays are automatically set to []
const author = await lenz.author.create({
  data: {
    name: 'John Doe',
    // bookIds is automatically set to [] even if not provided
  }
});
```

### One-to-Many / Many-to-One
A bidirectional relationship where one side has an array and the other has a single reference:

```graphql
type Author @model {
  id: ID! @id
  books: [Book!]! @relation(field: "bookIds")  # one-to-many side, auto: lookup strategy
  bookIds: [ID!]!                               # array automatically indexed (multikey index)
}

type Book @model {
  id: ID! @id
  author: Author! @relation(field: "authorId")  # many-to-one side, auto: populate strategy
  authorId: ID!                                 # single ID automatically indexed (sparse index)
}
```

- **Author → Book (one-to-many):** Uses `lookup` strategy by default (server-side join). Requires manual synchronization of `bookIds` array.
- **Book → Author (many-to-one):** Uses `populate` strategy by default (separate query). Foreign key `authorId` has automatic sparse index.
- **Indexes:** Multikey index on `bookIds`, sparse index on `authorId` (created automatically).

### One-to-One (foreign key single ID in source model)

```graphql
type User @model {
  id: ID! @id
  profile: Profile @relation(field: "profileId")  # auto: populate strategy
  profileId: ID                                   # optional, sparse index
}

type Profile @model {
  id: ID! @id
  user: User @relation(field: "userId", strategy: "populate")  # explicit populate
  userId: ID                                   # optional, sparse index
}
```

- **Strategy:** Uses `populate` by default (separate queries for each side)
- **Indexes:** Sparse indexes on `profileId` and `userId` (optional fields)
- **Optional:** Both sides can be optional (nullable IDs)
- **Bidirectional:** Each side maintains its own foreign key

### Many-to-Many (ID arrays on both sides)

```graphql
type Post @model {
  id: ID! @id
  categories: [Category!]! @relation(field: "categoryIds")  # auto: populate strategy
  categoryIds: [ID!]!                                        # multikey index
}

type Category @model {
  id: ID! @id
  posts: [Post!]! @relation(field: "postIds", strategy: "lookup", index: false)
  postIds: [ID!]!                                            # no auto-index (index: false)
}
```

- **Strategy:** Uses `populate` by default (`lookup` not yet implemented for many-to-many)
- **Indexes:** Multikey indexes on both array fields (configurable with `index: false`)
- **Bidirectional:** Both sides maintain arrays of IDs
- **Manual sync:** You must synchronize both arrays when creating/updating relations

**Important:** Foreign keys must always be in the **source model** (the model containing the `@relation` directive). Classic one-to-many patterns with foreign keys in target models will cause validation errors.

## Relation Loading Strategies

Lenz automatically chooses the optimal strategy for loading related data, balancing performance and simplicity. You can also explicitly override the strategy.

### Populate Strategy (Default for oneToOne, manyToOne)

Uses separate queries - first fetches the main document, then queries related collections. Best for simple relationships and sharded environments.

```graphql
type User @model {
  profile: Profile @relation(field: "profileId", strategy: "populate")
  profileId: ID
}
```

### Lookup Strategy (Default for oneToMany)

Uses MongoDB's `$lookup` aggregation operator for server-side joins. Best for high-read scenarios with bidirectional relationships.

```graphql
type Author @model {
  books: [Book!]! @relation(field: "bookIds", strategy: "lookup")
  bookIds: [ID!]!
}
```

**Note:** When using `lookup` strategy, you must manually synchronize ID arrays (e.g., `bookIds`) when creating/updating/deleting related documents.

### Automatic Strategy Selection

| Relation Type | Default Strategy | Reason |
|--------------|------------------|--------|
| `oneToOne` | `populate` | Simple relationships, no arrays |
| `manyToOne` | `populate` | Single reference, no arrays |
| `oneToMany` | `lookup` | Array of IDs, bidirectional relationships |
| `manyToMany` | `populate` | Requires manual synchronization |

### Automatic Indexing

Lenz automatically creates indexes for foreign key fields when `index: true` (default). You can disable this:

```graphql
type Author @model {
  books: [Book!]! @relation(field: "bookIds", index: false)
  bookIds: [ID!]!
}
```

- For arrays (oneToMany): Creates multikey indexes
- For single IDs (oneToOne, manyToOne): Creates sparse indexes

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

## Best Practices with MongoDB

### 1. Schema Design
- **Embed documents** when data is accessed together frequently (use `@embedded` directive)
- **Reference documents** when data is large or accessed independently
- **Use arrays judiciously** - large arrays can impact performance
- **Denormalize carefully** - duplicate data for read performance, but maintain consistency

### 2. Index Strategy
- **Auto-index foreign keys** - Lenz does this by default with `index: true`
- **Add compound indexes** for frequently queried field combinations
- **Use sparse indexes** for optional fields (auto-created for optional relations)
- **Monitor index usage** with `$indexStats`

### 3. Performance Optimization
- **Use `lookup` strategy** for high-read bidirectional relationships
- **Use `populate` strategy** for simple relationships and sharded clusters
- **Batch operations** with `createMany`, `updateMany` instead of individual calls
- **Project only needed fields** with `select` option

### 4. Query Patterns
- **Filter early** - push filters to database with `where` clauses
- **Avoid large skip/limit** - use cursor-based pagination (`cursor` option)
- **Use transactions** for multi-document consistency (requires replica set)
- **Monitor slow queries** with MongoDB profiler

### 5. Data Consistency
- **Manual array sync** - when using `lookup` strategy, maintain ID arrays
- **Use default values** for required fields to avoid validation errors
- **Handle race conditions** with optimistic concurrency or transactions
- **Implement soft deletes** with `deletedAt` field instead of hard deletes

### 6. When to Use Each Strategy

#### Use **Populate** when:
- Simple one-to-one or many-to-one relationships
- Working with sharded clusters (`$lookup` doesn't work across shards)
- Relationships are rarely accessed
- You prefer automatic data consistency

#### Use **Lookup** when:
- High-read scenarios with one-to-many relationships
- Need server-side joins for complex filtering/sorting
- Willing to manually maintain ID arrays
- Maximum read performance is critical

### 7. Production Readiness
- **Enable replica set** for transaction support
- **Set up proper connection pooling** in `lenz.config.ts`
- **Implement retry logic** for transient failures
- **Use environment-specific configurations**
- **Monitor connection health** with regular `ping` commands

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