import { GraphQLDirective, DirectiveLocation, GraphQLString, GraphQLNonNull, GraphQLBoolean } from 'graphql';

// Определение всех директив Lenz ORM
export const modelDirective = new GraphQLDirective({
  name: 'model',
  locations: [DirectiveLocation.OBJECT],
  description: 'Marks a GraphQL type as a database model'
});

export const idDirective = new GraphQLDirective({
  name: 'id',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  description: 'Marks a field as primary key (auto-generated ObjectId)'
});

export const uniqueDirective = new GraphQLDirective({
  name: 'unique',
  locations: [DirectiveLocation.FIELD_DEFINITION],
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
      type: new GraphQLNonNull(GraphQLString),
      description: 'Default value for the field'
    }
  },
  description: 'Sets a default value for a field'
});

export const relationDirective = new GraphQLDirective({
  name: 'relation',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
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
  hideDirective
];

// Утилита для проверки, является ли директива директивой Lenz
export function isLenzDirective(directiveName: string): boolean {
  return lenzDirectives.some(d => d.name === directiveName);
}

// Утилита для получения определения директивы по имени
export function getDirectiveDefinition(directiveName: string): GraphQLDirective | undefined {
  return lenzDirectives.find(d => d.name === directiveName);
}