/**
 * Structured error classes for Lenz ORM
 */

export class LenzError extends Error {
  public readonly code: string;
  public readonly details: Record<string, any> | undefined;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'LenzError';
    this.code = code;
    this.details = details;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LenzError);
    }
  }
}

export class SchemaValidationError extends LenzError {
  constructor(message: string, details?: Record<string, any>) {
    super('SCHEMA_VALIDATION_ERROR', message, details);
    this.name = 'SchemaValidationError';
  }
}

export class SchemaParseError extends LenzError {
  constructor(message: string, details?: Record<string, any>) {
    super('SCHEMA_PARSE_ERROR', message, details);
    this.name = 'SchemaParseError';
  }
}

export class CodeGenerationError extends LenzError {
  constructor(message: string, details?: Record<string, any>) {
    super('CODE_GENERATION_ERROR', message, details);
    this.name = 'CodeGenerationError';
  }
}

export class ConfigurationError extends LenzError {
  constructor(message: string, details?: Record<string, any>) {
    super('CONFIGURATION_ERROR', message, details);
    this.name = 'ConfigurationError';
  }
}

export class DatabaseError extends LenzError {
  constructor(message: string, details?: Record<string, any>) {
    super('DATABASE_ERROR', message, details);
    this.name = 'DatabaseError';
  }
}

// Specific validation errors
export class CircularDependencyError extends SchemaValidationError {
  constructor(modelNames: string[], details?: Record<string, any>) {
    super(`Circular dependency detected between models: ${modelNames.join(' -> ')}`, {
      modelNames,
      ...details
    });
    this.name = 'CircularDependencyError';
  }
}

export class DuplicateModelError extends SchemaValidationError {
  constructor(modelName: string, details?: Record<string, any>) {
    super(`Duplicate model name: ${modelName}`, {
      modelName,
      ...details
    });
    this.name = 'DuplicateModelError';
  }
}

export class DuplicateFieldError extends SchemaValidationError {
  constructor(modelName: string, fieldName: string, details?: Record<string, any>) {
    super(`Duplicate field '${fieldName}' in model '${modelName}'`, {
      modelName,
      fieldName,
      ...details
    });
    this.name = 'DuplicateFieldError';
  }
}

export class InvalidFieldTypeError extends SchemaValidationError {
  constructor(modelName: string, fieldName: string, fieldType: string, details?: Record<string, any>) {
    super(`Invalid field type '${fieldType}' for field '${fieldName}' in model '${modelName}'`, {
      modelName,
      fieldName,
      fieldType,
      ...details
    });
    this.name = 'InvalidFieldTypeError';
  }
}

export class InvalidDirectiveError extends SchemaValidationError {
  constructor(directiveName: string, location: string, details?: Record<string, any>) {
    super(`Invalid directive '@${directiveName}' at ${location}`, {
      directiveName,
      location,
      ...details
    });
    this.name = 'InvalidDirectiveError';
  }
}

export class MissingRequiredFieldError extends SchemaValidationError {
  constructor(modelName: string, fieldName: string, details?: Record<string, any>) {
    super(`Missing required field '${fieldName}' in model '${modelName}'`, {
      modelName,
      fieldName,
      ...details
    });
    this.name = 'MissingRequiredFieldError';
  }
}

export class RelationValidationError extends SchemaValidationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'RelationValidationError';
  }
}

// Utility function to check if error is a LenzError
export function isLenzError(error: any): error is LenzError {
  return error && typeof error === 'object' && error.name === 'LenzError';
}