import { GraphQLDirective, DirectiveLocation, GraphQLString, GraphQLNonNull, GraphQLBoolean, GraphQLList } from 'graphql';

// Определение всех директив Lenz ORM
export const modelDirective = new GraphQLDirective({
  name: 'model',
  locations: [DirectiveLocation.OBJECT],
  description: 'Marks a GraphQL type as a database model'
});

export const idDirective = new GraphQLDirective({
  name: 'id',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
    name: {
      type: GraphQLString,
      description: 'Name for the primary key constraint (Prisma @id map parameter)'
    },
    map: {
      type: GraphQLString,
      description: 'Custom name for the underlying index in the database'
    }
  },
  description: 'Marks a field as primary key (auto-generated ObjectId)'
});

export const uniqueDirective = new GraphQLDirective({
  name: 'unique',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
    name: {
      type: GraphQLString,
      description: 'Name for the unique constraint (Prisma @unique map parameter)'
    },
    map: {
      type: GraphQLString,
      description: 'Custom name for the underlying index in the database'
    }
  },
  description: 'Creates a unique index on the field'
});

export const indexDirective = new GraphQLDirective({
  name: 'index',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  description: 'Creates a regular index on the field'
});

export const defaultDirective = new GraphQLDirective({
  name: 'default',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
    value: {
      type: GraphQLString,
      description: 'Default value for the field (static value)'
    },
    generator: {
      type: GraphQLString,
      description: 'Default value generator: "uuid", "now", "cuid"'
    }
  },
  description: 'Sets a default value or generator for a field'
});

export const relationDirective = new GraphQLDirective({
  name: 'relation',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
    name: {
      type: GraphQLString,
      description: 'Name for the relation (required when a model has multiple relations to the same target model)'
    },
    field: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'The field that stores the foreign key'
    },
    strategy: {
      type: GraphQLString,
      description: 'Strategy for loading related data: "populate" (default) or "lookup"'
    },
    index: {
      type: GraphQLBoolean,
      description: 'Whether to create an index on the foreign key field (default: true)'
    },
    onDelete: {
      type: GraphQLString,
      description: 'Cascade delete behavior: "Cascade" (delete related), "SetNull" (nullify FK), or "NoAction" (default, no cascade)'
    },
    onUpdate: {
      type: GraphQLString,
      description: 'Cascade update behavior: "SetNull" (nullify FK), "Cascade" (update related), or "NoAction" (default, no cascade)'
    }
  },
  description: 'Defines a relationship between models'
});

export const createdAtDirective = new GraphQLDirective({
  name: 'createdAt',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  description: 'Automatically sets timestamp on creation'
});

export const updatedAtDirective = new GraphQLDirective({
  name: 'updatedAt',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  description: 'Automatically updates timestamp on modification'
});

export const embeddedDirective = new GraphQLDirective({
  name: 'embedded',
  locations: [DirectiveLocation.OBJECT],
  description: 'Marks a type as embedded document (not stored in separate collection)'
});

export const hideDirective = new GraphQLDirective({
  name: 'hide',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  description: 'Excludes field from query results by default. Can be explicitly selected via select option.'
});

export const mapDirective = new GraphQLDirective({
  name: 'map',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
    name: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'The database field name to map to'
    }
  },
  description: 'Maps a field to a different database column name (Prisma @map)'
});

export const modelMapDirective = new GraphQLDirective({
  name: 'modelMap',
  locations: [DirectiveLocation.OBJECT],
  args: {
    name: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'The database collection name to map to (Prisma @@map)'
    }
  },
  description: 'Maps a model to a different database collection name (Prisma @@map)'
});

export const ignoreDirective = new GraphQLDirective({
  name: 'ignore',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  description: 'Excludes a field from database operations entirely (Prisma @ignore)'
});

export const compoundUniqueDirective = new GraphQLDirective({
  name: 'compoundUnique',
  locations: [DirectiveLocation.OBJECT],
  args: {
    fields: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
      description: 'Field names to include in the compound unique index'
    },
    name: {
      type: GraphQLString,
      description: 'Optional name for the unique constraint (maps to Prisma @@unique map parameter)'
    }
  },
  description: 'Creates a compound unique index on multiple fields (Prisma @@unique)'
});

export const compoundIndexDirective = new GraphQLDirective({
  name: 'compoundIndex',
  locations: [DirectiveLocation.OBJECT],
  args: {
    fields: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
      description: 'Field names to include in the compound index'
    },
    name: {
      type: GraphQLString,
      description: 'Optional name for the index (maps to Prisma @@index map parameter)'
    }
  },
  description: 'Creates a compound index on multiple fields (Prisma @@index)'
});

export const compoundIdDirective = new GraphQLDirective({
  name: 'compoundId',
  locations: [DirectiveLocation.OBJECT],
  args: {
    fields: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))),
      description: 'Field names to include in the compound primary key'
    },
    name: {
      type: GraphQLString,
      description: 'Optional name for the primary key constraint'
    }
  },
  description: 'Defines a compound primary key on multiple fields (Prisma @@id)'
});

export const fulltextDirective = new GraphQLDirective({
  name: 'fulltext',
  locations: [DirectiveLocation.OBJECT, DirectiveLocation.FIELD_DEFINITION],
  args: {
    fields: {
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
      description: 'Field names to include in the full-text index (for object-level usage: @@fulltext(fields: ["title", "description"]))'
    }
  },
  description: 'Creates a MongoDB text index on specified field(s) for full-text search'
});

export const emailDirective = new GraphQLDirective({
  name: 'email',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  description: 'Validates that the field value is a valid email address'
});

export const urlDirective = new GraphQLDirective({
  name: 'url',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  description: 'Validates that the field value is a valid URL'
});

export const regexDirective = new GraphQLDirective({
  name: 'regex',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
    pattern: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Regular expression pattern to validate the field value against'
    }
  },
  description: 'Validates that the field value matches a regular expression pattern'
});

// Экспорт всех директив
export const lenzDirectives = [
  modelDirective,
  idDirective,
  uniqueDirective,
  indexDirective,
  defaultDirective,
  relationDirective,
  createdAtDirective,
  updatedAtDirective,
  embeddedDirective,
  hideDirective,
  mapDirective,
  modelMapDirective,
  ignoreDirective,
  compoundUniqueDirective,
  compoundIndexDirective,
  compoundIdDirective,
  fulltextDirective,
  emailDirective,
  urlDirective,
  regexDirective
];

// Утилита для проверки, является ли директива директивой Lenz
export function isLenzDirective(directiveName: string): boolean {
  return lenzDirectives.some(d => d.name === directiveName);
}

// Утилита для получения определения директивы по имени
export function getDirectiveDefinition(directiveName: string): GraphQLDirective | undefined {
  return lenzDirectives.find(d => d.name === directiveName);
}