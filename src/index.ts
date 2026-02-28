// Main exports
export { LenzEngine } from './engine/LenzEngine';
export * from './config';

// CLI commands
import { generateCommand } from './cli/commands/generate';
import { initCommand } from './cli/commands/init';
import { studioCommand } from './cli/commands/studio';

// Types
export * from './engine/GraphQLParser';

// Default export
import { LenzEngine as LenzEngineClass } from './engine/LenzEngine';
export default {
  LenzEngine: LenzEngineClass,
  generate: generateCommand,
  init: initCommand,
  studio: studioCommand
};