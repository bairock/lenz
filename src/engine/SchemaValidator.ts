import {
  GraphQLModel,
  GraphQLEnum,
  ModelRelation,
  GraphQLField
} from './GraphQLParser';
import {
  SchemaValidationError,
  CircularDependencyError,
  DuplicateModelError,
  DuplicateFieldError,
  InvalidFieldTypeError,
  InvalidDirectiveError,
  RelationValidationError
} from '../errors';
import { isLenzDirective, getDirectiveDefinition } from './directives';

export interface ValidationOptions {
  /** Whether to check for circular dependencies (default: true) */
  checkCircularDependencies?: boolean;
  /** Whether to validate field types (default: true) */
  validateFieldTypes?: boolean;
  /** Whether to validate relations (default: true) */
  validateRelations?: boolean;
  /** Whether to validate directives (default: true) */
  validateDirectives?: boolean;
}

export class SchemaValidator {
  private models: GraphQLModel[];
  private enums: GraphQLEnum[];
  private relations: ModelRelation[];
  private supportedScalarTypes = new Set([
    'String', 'Int', 'Float', 'Boolean', 'ID',
    'DateTime', 'Date', 'Json', 'ObjectId'
  ]);

  constructor(
    models: GraphQLModel[],
    enums: GraphQLEnum[],
    relations: ModelRelation[]
  ) {
    this.models = models;
    this.enums = enums;
    this.relations = relations;
  }

  /**
   * Validate the entire schema
   */
  validate(options: ValidationOptions = {}): void {
    const {
      checkCircularDependencies = true,
      validateFieldTypes = true,
      validateRelations = true,
      validateDirectives = true
    } = options;

    // Basic validation
    this.validateModelNames();
    this.validateFieldNames();

    if (validateDirectives) {
      this.validateDirectives();
    }

    if (validateFieldTypes) {
      this.validateFieldTypes();
    }

    if (validateRelations) {
      this.validateRelations();
    }

    if (checkCircularDependencies) {
      this.checkCircularDependencies();
    }

    // Additional validations
    this.validateRequiredFields();
    this.validateEnumValues();
  }

  /**
   * Check for duplicate model names
   */
  private validateModelNames(): void {
    const seen = new Set<string>();
    for (const model of this.models) {
      if (seen.has(model.name)) {
        throw new DuplicateModelError(model.name);
      }
      seen.add(model.name);
    }
  }

  /**
   * Check for duplicate field names within each model
   */
  private validateFieldNames(): void {
    for (const model of this.models) {
      const seen = new Set<string>();
      for (const field of model.fields) {
        if (seen.has(field.name)) {
          throw new DuplicateFieldError(model.name, field.name);
        }
        seen.add(field.name);
      }
    }
  }

  /**
   * Validate field types
   */
  private validateFieldTypes(): void {
    const validTypes = new Set([
      ...this.supportedScalarTypes,
      ...this.models.map(m => m.name),
      ...this.enums.map(e => e.name)
    ]);

    for (const model of this.models) {
      for (const field of model.fields) {
        // Check if type exists (scalar, model, or enum)
        if (!validTypes.has(field.type)) {
          throw new InvalidFieldTypeError(
            model.name,
            field.name,
            field.type,
            { validTypes: Array.from(validTypes) }
          );
        }

        // Additional type-specific validations
        if (field.type === 'ID' && !field.isId) {
          // ID fields should typically have @id directive
          // This is a warning, not an error
          console.warn(
            `⚠️  Field '${field.name}' in model '${model.name}' has type ID but no @id directive`
          );
        }
      }
    }
  }

  /**
   * Validate directives
   */
  private validateDirectives(): void {
    for (const model of this.models) {
      // Check model-level directives
      for (const directive of model.fields.flatMap(f => f.directives)) {
        const directiveName = directive.replace(/^@/, '');

        if (isLenzDirective(directiveName)) {
          // Директива Lenz - проверяем соответствие ожидаемым местам применения
          const directiveDef = getDirectiveDefinition(directiveName);
          if (directiveDef) {
            // TODO: В будущем можно добавить проверку мест применения (DirectiveLocation)
            // Например, проверить что @model применяется только на уровне OBJECT
            // а @id только на FIELD_DEFINITION
          }
        } else {
          // Пользовательская директива - выводим предупреждение
          console.warn(`⚠️  Custom directive '@${directiveName}' detected in model '${model.name}'. ` +
            'Lenz does not validate custom directives.');
        }
      }

      // Field-level directive validation
      for (const field of model.fields) {
        this.validateFieldDirectives(model.name, field);
      }
    }
  }

  /**
   * Validate directives on a specific field
   */
  private validateFieldDirectives(modelName: string, field: GraphQLField): void {
    const directives = field.directives;

    // Check for conflicting directives
    if (directives.includes('id') && directives.includes('unique')) {
      throw new InvalidDirectiveError(
        'unique',
        `field '${field.name}' in model '${modelName}'`,
        { reason: 'Cannot have both @id and @unique directives on the same field' }
      );
    }

    // Validate @hide directive
    if (directives.includes('hide')) {
      if (directives.includes('id')) {
        throw new InvalidDirectiveError(
          'hide',
          `field '${field.name}' in model '${modelName}'`,
          { reason: 'Cannot use @hide directive on @id field' }
        );
      }
      if (field.isRelation) {
        throw new InvalidDirectiveError(
          'hide',
          `field '${field.name}' in model '${modelName}'`,
          { reason: 'Cannot use @hide directive on relation fields' }
        );
      }
    }

    // Note: @relation directive validation is skipped because relation detection
    // depends on model parsing order. Relations are validated separately.

    // Note: @default directive arguments are now preserved and parsed via AST
    // in GraphQLParser.getDefaultValue() method.
  }

  /**
   * Validate relations between models
   */
  private validateRelations(): void {
    for (const relation of this.relations) {
      const sourceModel = this.models.find(m => m.name === relation.field);
      const targetModel = this.models.find(m => m.name === relation.target);

      if (!sourceModel) {
        throw new RelationValidationError(
          `Source model '${relation.field}' not found for relation`,
          { relation }
        );
      }

      if (!targetModel) {
        throw new RelationValidationError(
          `Target model '${relation.target}' not found for relation`,
          { relation }
        );
      }

      // Check if foreign key field exists for certain relation types
      if (relation.foreignKey) {
        const hasForeignKey = targetModel.fields.some(f =>
          f.name === relation.foreignKey || f.name === `${relation.foreignKey}Id`
        );

        if (!hasForeignKey) {
          throw new RelationValidationError(
            `Foreign key field '${relation.foreignKey}' not found in target model '${relation.target}'`,
            { relation }
          );
        }
      }
    }
  }

  /**
   * Check for circular dependencies between models
   */
  private checkCircularDependencies(): void {
    const graph = new Map<string, string[]>();

    // Build dependency graph
    for (const model of this.models) {
      const dependencies = model.fields
        .filter(field => field.isRelation)
        .map(field => field.type);
      graph.set(model.name, dependencies);
    }

    // Detect cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          cycles.push(cycle);
        }
      }

      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    // Report cycles
    if (cycles.length > 0) {
      // Deduplicate cycles (same cycle may be found multiple times)
      const uniqueCycles = cycles.map(cycle => cycle.join(' -> '))
        .filter((value, index, self) => self.indexOf(value) === index);

      for (const cycle of uniqueCycles) {
        throw new CircularDependencyError(
          cycle.split(' -> '),
          { cycle }
        );
      }
    }
  }

  /**
   * Validate that required fields have values
   */
  private validateRequiredFields(): void {
    for (const model of this.models) {
      for (const field of model.fields) {
        if (field.isRequired && !field.isId && !field.defaultValue) {
          // Check if it's a relation field (relations can be required but handled differently)
          if (!field.isRelation) {
            console.warn(
              `⚠️  Required field '${field.name}' in model '${model.name}' has no default value`
            );
          }
        }
      }
    }
  }

  /**
   * Validate enum values
   */
  private validateEnumValues(): void {
    for (const enumDef of this.enums) {
      if (enumDef.values.length === 0) {
        throw new SchemaValidationError(
          `Enum '${enumDef.name}' must have at least one value`
        );
      }

      // Check for duplicate enum values
      const seen = new Set<string>();
      for (const value of enumDef.values) {
        if (seen.has(value)) {
          throw new SchemaValidationError(
            `Duplicate value '${value}' in enum '${enumDef.name}'`
          );
        }
        seen.add(value);
      }
    }
  }

  /**
   * Get validation warnings (non-critical issues)
   */
  getWarnings(): string[] {
    const warnings: string[] = [];

    for (const model of this.models) {
      // Warn about models without @id field
      const hasIdField = model.fields.some(f => f.isId);
      if (!hasIdField) {
        warnings.push(`Model '${model.name}' has no @id field`);
      }

      // Warn about required fields without defaults
      for (const field of model.fields) {
        if (field.isRequired && !field.isId && !field.defaultValue && !field.isRelation) {
          warnings.push(
            `Required field '${field.name}' in model '${model.name}' has no default value`
          );
        }
      }
    }

    return warnings;
  }
}