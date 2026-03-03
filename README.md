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

## CRUD Operations

Lenz provides a comprehensive set of CRUD operations similar to Prisma, with full TypeScript support and MongoDB-native performance.

### Create

**Create a single record:**
```ts
const user = await lenz.user.create({
  data: {
    email: "elsa@prisma.io",
    name: "Elsa Prisma",
  },
});
```

**Create multiple records:**
```ts
const createMany = await lenz.user.createMany({
  data: [
    { name: "Bob", email: "bob@prisma.io" },
    { name: "Yewande", email: "yewande@prisma.io" },
  ],
});
// Returns: { count: 2 }
```

### Read

**Get record by ID or unique field:**
```ts
// By unique field
const user = await lenz.user.findUnique({
  where: { email: "elsa@prisma.io" },
});

// By ID
const user = await lenz.user.findUnique({
  where: { id: "99" },
});
```

**Get all records:**
```ts
const users = await lenz.user.findMany();
```

**Get first matching record:**
```ts
const user = await lenz.user.findFirst({
  where: { posts: { some: { likes: { gt: 100 } } } },
  orderBy: { id: "desc" },
});
```

**Filter records:**
```ts
// Single field filter
const users = await lenz.user.findMany({
  where: { email: { endsWith: "prisma.io" } },
});

// Multiple conditions with OR/AND
const users = await lenz.user.findMany({
  where: {
    OR: [{ name: { startsWith: "E" } }, { AND: { profileViews: { gt: 0 }, role: "ADMIN" } }],
  },
});

// Filter by related records
const users = await lenz.user.findMany({
  where: {
    email: { endsWith: "prisma.io" },
    posts: { some: { published: false } },
  },
});
```

**Select fields:**
```ts
const user = await lenz.user.findUnique({
  where: { email: "emma@prisma.io" },
  select: { email: true, name: true },
});
// Returns: { email: 'emma@prisma.io', name: "Emma" }
```

**Include related records:**
```ts
const users = await lenz.user.findMany({
  where: { role: "ADMIN" },
  include: { posts: true },
});
```

### Update

**Update a single record:**
```ts
const updateUser = await lenz.user.update({
  where: { email: "viola@prisma.io" },
  data: { name: "Viola the Magnificent" },
});
```

**Update multiple records:**
```ts
const updateUsers = await lenz.user.updateMany({
  where: { email: { contains: "prisma.io" } },
  data: { role: "ADMIN" },
});
// Returns: { count: 19 }
```

**Upsert (update or create):**
```ts
const upsertUser = await lenz.user.upsert({
  where: { email: "viola@prisma.io" },
  update: { name: "Viola the Magnificent" },
  create: { email: "viola@prisma.io", name: "Viola the Magnificent" },
});
```

**Atomic number operations:**
```ts
await lenz.post.updateMany({
  data: {
    views: { increment: 1 },
    likes: { increment: 1 },
  },
});
```

### Delete

**Delete a single record:**
```ts
const deleteUser = await lenz.user.delete({
  where: {
    email: "bert@prisma.io",
  },
});
```

**Delete multiple records:**
```ts
const deleteUsers = await lenz.user.deleteMany({
  where: {
    email: {
      contains: "prisma.io",
    },
  },
});
```

**Delete all records:**
```ts
const deleteUsers = await lenz.user.deleteMany({});
```

**Cascading deletes:** Lenz does not automatically cascade deletes. You must manually delete related records or use transactions:

```ts
const transaction = await lenz.$transaction([
  lenz.post.deleteMany({ where: { authorId: "7" } }),
  lenz.user.delete({ where: { id: "7" } }),
]);
```

### Pagination

Lenz supports both offset-based and cursor-based pagination directly in the `findMany` method.

**Offset-based pagination (skip/take):**
```ts
// Get records 41-50 (page 5 with 10 per page)
const users = await lenz.user.findMany({
  skip: 40,
  take: 10,
  where: { /* your filters */ },
  orderBy: { createdAt: 'desc' }
});
```

**Cursor-based pagination (more efficient for large datasets):**
```ts
// Get first page (first 10 records)
const firstPage = await lenz.post.findMany({
  take: 10,
  where: { published: true },
  orderBy: { id: 'asc' },
});

const lastPost = firstPage[9]; // Last item on page
const cursor = lastPost?.id; // Use ID as cursor (string)

// Get next page (next 10 records AFTER cursor)
const nextPage = await lenz.post.findMany({
  take: 10,
  skip: 1, // Skip the cursor item itself to avoid duplication
  cursor: cursor, // Pass cursor as string
  where: { published: true },
  orderBy: { id: 'asc' },
});
```

**Note:** For cursor-based pagination, the cursor should be the value of the field you're ordering by (typically `id`). The cursor is passed as a string or ObjectId. Ensure the field is unique and sequential.

### Aggregation

Lenz provides direct access to MongoDB aggregation pipeline for complex data analysis, as well as count operations.

**Basic aggregation with MongoDB pipeline:**
```ts
const aggregations = await lenz.user.aggregate([
  { $match: { role: "ADMIN" } },
  { $group: { _id: "$country", totalViews: { $sum: "$profileViews" } } },
  { $sort: { totalViews: -1 } }
]);
```

**Count operations:**
```ts
// Count all users
const userCount = await lenz.user.count();

// Count with filtering
const activeUsers = await lenz.user.count({
  where: { profileViews: { gte: 100 } },
});

// Count relations (using _count in select)
const usersWithPostCount = await lenz.user.findMany({
  select: {
    _count: {
      select: { posts: true },
    },
  },
});
```

**Aggregation with grouping and filtering:**
```ts
// Group posts by category and calculate average likes
const stats = await lenz.post.aggregate([
  { $match: { published: true } },
  { $group: {
      _id: "$categoryId",
      totalPosts: { $sum: 1 },
      avgLikes: { $avg: "$likes" },
      maxLikes: { $max: "$likes" }
  }},
  { $sort: { avgLikes: -1 } }
]);
```

**Distinct values:**
```ts
// Get distinct roles using aggregation
const distinctRoles = await lenz.user.aggregate([
  { $group: { _id: "$role" } },
  { $project: { role: "$_id" } }
]);
```

**Note:** The `aggregate()` method accepts raw MongoDB aggregation pipeline stages. For type-safe aggregations, you can define TypeScript interfaces for the aggregation result.

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

  # Many-to-many relationship with ID arrays (auto-selects lookup strategy)
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
      categories: true   // many-to-many lookup strategy (server-side join with $lookup)
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

  // Advanced many-to-many lookup with filtering
  // Uses MongoDB aggregation pipeline for server-side joins
  const postsWithTechCategories = await lenz.post.findMany({
    where: {
      categories: {
        some: {
          name: { equals: 'Technology' }
        }
      }
    },
    include: {
      categories: {
        where: {
          name: { equals: 'Technology' }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  // Note: For lookup strategy, array synchronization is manual
  // When creating relationships, update both arrays:
  // await lenz.post.update({ where: { id: postId }, data: { categoryIds: { push: categoryId } } });
  // await lenz.category.update({ where: { id: categoryId }, data: { postIds: { push: postId } } });

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
  categories: [Category!]! @relation(field: "categoryIds")  # auto: lookup strategy (default for arrays)
  categoryIds: [ID!]!                                        # multikey index
}

type Category @model {
  id: ID! @id
  posts: [Post!]! @relation(field: "postIds", strategy: "lookup", index: false)
  postIds: [ID!]!                                            # no auto-index (index: false)
}
```

- **Strategy:** Uses `lookup` by default when foreign key arrays are specified (server-side joins with MongoDB's `$lookup` aggregation), `populate` for join collections
- **Indexes:** Multikey indexes on both array fields (configurable with `index: false`)
- **Bidirectional:** Both sides maintain arrays of IDs
- **Manual sync:** You must manually synchronize both arrays when creating/updating relations (for `lookup` strategy)

**Example - Manual synchronization for many-to-many lookup strategy:**

```typescript
// Create a post and category
const post = await lenz.post.create({
  data: {
    title: 'My Post',
    categoryIds: [] // Initialize empty array
  }
});

const category = await lenz.category.create({
  data: {
    name: 'Technology',
    postIds: [] // Initialize empty array
  }
});

// Add category to post
await lenz.post.update({
  where: { id: post.id },
  data: {
    categoryIds: {
      push: category.id // Add category ID to post's array
    }
  }
});

// Add post to category (bidirectional sync)
await lenz.category.update({
  where: { id: category.id },
  data: {
    postIds: {
      push: post.id // Add post ID to category's array
    }
  }
});
```

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

**Include options support:** Lookup strategy now supports `where`, `orderBy`, `take`, and `skip` options for filtering, sorting, and paginating related documents.

Example:
```typescript
const author = await lenz.author.findUnique({
  where: { id: 'author-id' },
  include: {
    books: {
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    }
  }
});
```

### Automatic Strategy Selection

| Relation Type | Default Strategy | Reason |
|--------------|------------------|--------|
| `oneToOne` | `populate` | Simple relationships, no arrays |
| `manyToOne` | `populate` | Single reference, no arrays |
| `oneToMany` | `lookup` | Array of IDs in source document (e.g., Author.bookIds) |
| `manyToMany` | `lookup` (if foreign key array specified) or `populate` (if join collection) | Foreign key arrays use server-side joins, join collections use separate queries |

**Note:** The lookup strategy now supports include options (where, orderBy, take, skip) for both array foreign keys and single foreign key relations. However, nested includes are not yet supported for lookup strategy but are fully supported for populate strategy.

**Many-to-Many Lookup Strategy:**

When a many-to-many relationship uses foreign key arrays (either single-sided or both sides), Lenz automatically uses the `lookup` strategy with MongoDB's `$lookup` aggregation operator. This performs server-side joins for optimal read performance. For example, `post.categoryIds` array referencing categories.

```graphql
type Post @model {
  categories: [Category!]! @relation(field: "categoryIds", strategy: "lookup")
  categoryIds: [ID!]!  # multikey index automatically created
}

type Category @model {
  posts: [Post!]! @relation(field: "postIds", strategy: "lookup", index: false)
  postIds: [ID!]!  # no auto-index (index: false)
}
```

**Many-to-Many Populate Strategy:**

When a many-to-many relationship uses a join collection (no foreign key arrays), Lenz uses the `populate` strategy with separate queries.

```graphql
type Post @model {
  categories: [Category!]! @relation  # no field parameter → join collection
}

type Category @model {
  posts: [Post!]! @relation
}
```

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

### 6. Many-to-Many Performance Optimization
- **Array size limits:** Keep array sizes reasonable (<1000 elements). Large arrays increase `$lookup` complexity and memory usage.
- **Batch synchronization:** When updating multiple relationships, batch array operations to reduce database round trips.
- **Index management:** Regularly monitor and optimize multikey indexes for array fields.
- **Alternative approaches:** For extremely large many-to-many relationships, consider:
  - **Denormalization:** Embed frequently accessed data
  - **Hybrid approach:** Use `lookup` for recent/active relationships, `populate` for historical
  - **Materialized views:** Pre-compute relationships for read-heavy scenarios

### 7. When to Use Each Strategy

#### Use **Populate** when:
- Simple one-to-one or many-to-one relationships
- Working with sharded clusters (`$lookup` doesn't work across shards)
- Relationships are rarely accessed
- You prefer automatic data consistency
- Many-to-many relationships with join collections (no foreign key arrays)
- Small datasets where separate queries are acceptable

#### Use **Lookup** when:
- High-read scenarios with one-to-many or many-to-many relationships
- Need server-side joins for complex filtering/sorting
- Willing to manually maintain ID arrays
- Maximum read performance is critical
- Many-to-many relationships with foreign key arrays (both sides)
- Medium to large datasets where join performance matters

#### Special Considerations for Many-to-Many Lookup:
- **Array size:** Large arrays (>1000 IDs) can impact `$lookup` performance. Consider denormalization or hybrid approaches.
- **Indexing:** Multikey indexes are essential for array fields. Monitor index size and performance.
- **Consistency:** Manual array synchronization requires careful application logic to maintain data integrity.
- **Sharding:** `$lookup` doesn't work across shards. For sharded clusters, use `populate` strategy or ensure related documents are on the same shard.

### 8. Production Readiness
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