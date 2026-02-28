#!/usr/bin/env node

import { Command } from 'commander';
import { generateCommand } from './commands/generate';
import { initCommand } from './commands/init';
import { studioCommand } from './commands/studio';
import chalk from 'chalk';
import figlet from 'figlet';

const program = new Command();

program
  .name('lenz')
  .description('Lenz CLI - GraphQL-based ORM for MongoDB')
  .version('1.0.0')
  .configureOutput({
    outputError: (str, write) => write(chalk.red(str))
  });

program.addCommand(initCommand);
program.addCommand(generateCommand);
program.addCommand(studioCommand);

if (process.argv.length === 2) {
  console.log(chalk.cyan(figlet.textSync('Lenz', { horizontalLayout: 'full' })));
  console.log(chalk.gray('GraphQL-based ORM for MongoDB\n'));
  program.outputHelp();
} else {
  program.parse(process.argv);
}