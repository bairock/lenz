// Main exports
export { LenzEngine } from './engine/LenzEngine.js';
export * from './config/index.js';

// CLI commands
import { generateCommand } from './cli/commands/generate.js';
import { initCommand } from './cli/commands/init.js';

// Types
export * from './engine/GraphQLParser.js';

// Default export
import { LenzEngine as LenzEngineClass } from './engine/LenzEngine.js';
export default {
  LenzEngine: LenzEngineClass,
  generate: generateCommand,
  init: initCommand
};