import * as ts from 'typescript';

// GraphQL → TypeScript type mapping
export const typeMap: Record<string, string> = {
  'String': 'string',
  'Int': 'number',
  'Float': 'number',
  'Boolean': 'boolean',
  'ID': 'string',
  'DateTime': 'Date',
  'Date': 'Date',
  'Json': 'any',
  'ObjectId': 'string'
};

export function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function toCollectionName(modelName: string): string {
  return modelName.toLowerCase() + 's';
}

export function mapToTSType(type: string, isArray: boolean, customTypeMap: Record<string, string> = typeMap): string {
  let baseType = customTypeMap[type] || type;
  if (isArray) return `${baseType}[]`;
  return baseType;
}

export function getScalarFilterType(graphqlType: string, isRequired: boolean): string {
  const nullable = isRequired ? '' : 'Nullable';
  switch (graphqlType) {
    case 'String': return `string | String${nullable}Filter`;
    case 'Int': return `number | Int${nullable}Filter`;
    case 'Float': return `number | Float${nullable}Filter`;
    case 'Boolean': return `boolean | Boolean${nullable}Filter`;
    case 'DateTime':
    case 'Date': return `Date | string | DateTime${nullable}Filter`;
    case 'ID': return `string | IDFilter`;
    case 'ObjectId': return `string | String${nullable}Filter`;
    case 'Json': return `any | JsonFilter`;
    default: return `string | EnumFilter`; // Enum fallback
  }
}

export function getScalarArrayFilterType(graphqlType: string): string {
  switch (graphqlType) {
    case 'String': return `string | StringArrayFilter`;
    case 'Int': return `number | IntArrayFilter`;
    case 'Float': return `number | FloatArrayFilter`;
    case 'DateTime':
    case 'Date': return `Date | string | DateTimeArrayFilter`;
    default: return `string | StringArrayFilter`;
  }
}

// ===== TypeScript Compilation Helpers =====

export function addJsExtensionsToImports(content: string): string {
  let result = content;
  result = result.replace(/import type/g, 'import');
  result = result.replace(/from\s+['"](\.\.?\/[^'"]*)['"]/g, (_match, p1) => {
    if (p1.endsWith('.js') || p1.endsWith('.ts')) return _match;
    const quoteChar = _match.includes('"') ? '"' : "'";
    return `from ${quoteChar}${p1}.js${quoteChar}`;
  });
  result = result.replace(/import\s+['"](\.\.?\/[^'"]*)['"]/g, (_match, p1) => {
    if (p1.endsWith('.js') || p1.endsWith('.ts')) return _match;
    const quoteChar = _match.includes('"') ? '"' : "'";
    return `import ${quoteChar}${p1}.js${quoteChar}`;
  });
  return result;
}

export function removeTypeScriptSyntax(content: string): string {
  let result = content;
  result = result.replace(/(\w+)\s*:\s*[^=;,\n]+(?=\s*(=|;|,|\n))/g, '$1');
  result = result.replace(/(\w+)<[^>]+>(?=\s*[\s\(])/g, '$1');
  result = result.replace(/\s*:\s*[^{]+(?=\s*{)/g, '');
  result = result.replace(/\s+as\s+[^,\n;]+/g, '');
  result = result.replace(/export\s+(type|interface)\s+\w+.*\n/g, '');
  result = result.replace(/ as const/g, '');
  result = result.replace(/\b(private|protected|public)\s+/g, '');
  result = result.replace(/\n\s*\n\s*\n/g, '\n\n');
  return result;
}

export function convertToJavaScript(content: string): string {
  let result = addJsExtensionsToImports(content);
  result = removeTypeScriptSyntax(result);
  return result;
}

export function compileTypeScriptToJavaScript(content: string): string {
  try {
    const result = ts.transpileModule(content, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        removeComments: false,
        preserveConstEnums: true,
        sourceMap: true,
        inlineSourceMap: true,
        declaration: false,
        strict: false,
        esModuleInterop: true,
        skipLibCheck: true
      }
    });
    return addJsExtensionsToImports(result.outputText);
  } catch (error) {
    console.error('TypeScript compilation failed:', error);
    return convertToJavaScript(content);
  }
}

export function convertTypesToJavaScript(content: string): string {
  const constExports: Array<{name: string, value: string}> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const constMatch = line.match(/export const (\w+)\s*=\s*(.+)/);
    if (constMatch) {
      const name = constMatch[1];
      let value = constMatch[2];
      let braceCount = (value.match(/{/g) || []).length - (value.match(/}/g) || []).length;
      let j = i;
      while (braceCount > 0 && j + 1 < lines.length) {
        j++;
        const nextLine = lines[j];
        value += '\n' + nextLine;
        braceCount += (nextLine.match(/{/g) || []).length - (nextLine.match(/}/g) || []).length;
      }
      value = value.replace(/ as const/g, '');
      constExports.push({name, value});
    }
  }

  const stubExportNames = new Set<string>();
  const interfaceMatches = content.match(/export interface (\w+)/g);
  if (interfaceMatches) {
    interfaceMatches.forEach(match => {
      const name = match.replace('export interface ', '').trim();
      if (!constExports.some(exp => exp.name === name)) {
        stubExportNames.add(name);
      }
    });
  }
  const typeMatches = content.match(/export type (\w+)/g);
  if (typeMatches) {
    typeMatches.forEach(match => {
      const name = match.replace('export type ', '').split('<')[0].trim();
      if (!constExports.some(exp => exp.name === name)) {
        stubExportNames.add(name);
      }
    });
  }
  const namedExportMatches = content.match(/export \{([^}]+)\}/g);
  if (namedExportMatches) {
    namedExportMatches.forEach(match => {
      const namesStr = match.replace('export {', '').replace('}', '').trim();
      const names = namesStr.split(',').map(n => n.trim()).filter(n => n.length > 0);
      names.forEach(name => {
        if (!constExports.some(exp => exp.name === name)) {
          stubExportNames.add(name);
        }
      });
    });
  }

  let result = `// This file was auto-generated by Lenz. Do not edit manually.
// @generated
// This file provides JavaScript-compatible exports for TypeScript types.
// TypeScript projects should use the .d.ts files for full type information.

`;

  const importLines = lines.filter(line => line.includes('import '));
  const processedImports = new Set<string>();
  for (const line of importLines) {
    let processed = line.replace(/import type/g, 'import');
    processed = processed.replace(/from '\.\/([^']+)'/g, (_match, p1) => {
      if (p1.endsWith('.js') || p1.endsWith('.ts')) return _match;
      return `from './${p1}.js'`;
    });
    if (!processedImports.has(processed)) {
      processedImports.add(processed);
      result += processed + '\n';
    }
  }
  if (processedImports.size > 0) result += '\n';

  constExports.forEach(exp => {
    result += `export const ${exp.name} = ${exp.value};\n`;
  });
  if (constExports.length > 0) result += '\n';

  const stubExportArray = Array.from(stubExportNames);
  if (stubExportArray.length > 0) {
    stubExportArray.forEach(name => {
      result += `export const ${name} = undefined;\n`;
    });
    result += `\nexport default {\n`;
    [...constExports.map(exp => exp.name), ...stubExportArray].forEach((name, index, arr) => {
      result += `  ${name}: ${name}${index < arr.length - 1 ? ',' : ''}\n`;
    });
    result += `};\n`;
  } else if (constExports.length > 0) {
    result += `\nexport default {\n`;
    constExports.forEach((exp, index) => {
      result += `  ${exp.name}: ${exp.name}${index < constExports.length - 1 ? ',' : ''}\n`;
    });
    result += `};\n`;
  } else {
    result += `export {};\n`;
  }

  return result;
}

export function convertToDeclaration(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let state: 'normal' | 'class-body' | 'skip-body' = 'normal';
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line;

    if (state === 'skip-body') {
      braceDepth += (trimmed.match(/\{/g) || []).length;
      braceDepth -= (trimmed.match(/\}/g) || []).length;
      if (braceDepth <= 0) {
        state = 'class-body';
        braceDepth = 1;
      }
      continue;
    }

    if (state === 'class-body') {
      const openBrace = (trimmed.match(/\{/g) || []).length;
      const closeBrace = (trimmed.match(/\}/g) || []).length;
      braceDepth += openBrace - closeBrace;

      if (braceDepth <= 0) {
        state = 'normal';
        result.push(line);
        continue;
      }

      const isMember = /^\s*(?:(?:private|public|protected|static)\s+)*(?:async\s+)?(?:get\s+|set\s+)?\w+\s*\(/.test(trimmed);
      const isCtor = /^\s*(?:private|public|protected|static\s+)?constructor\s*\(/.test(trimmed);
      const isMethod = isMember || isCtor;

      if (isMethod && trimmed.includes('{')) {
        const lastBrace = trimmed.lastIndexOf('{');
        result.push(trimmed.substring(0, lastBrace).trimEnd() + ';');
        const afterBrace = trimmed.substring(lastBrace + 1);
        const remainingOpen = (afterBrace.match(/\{/g) || []).length;
        const remainingClose = (afterBrace.match(/\}/g) || []).length;
        if (remainingOpen > remainingClose) {
          state = 'skip-body';
          braceDepth = remainingOpen - remainingClose;
        }
        continue;
      }

      if (isMethod) {
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') j++;
        if (j < lines.length && lines[j].trim() === '{') {
          result.push(line + ';');
          i = j;
          state = 'skip-body';
          braceDepth = 1;
          continue;
        }
        result.push(line);
        continue;
      }

      if (/^\s*(?:(?:private|public|protected|readonly|static)\s+)*\w+\??\s*:\s*\S+\s*=/.test(trimmed) &&
          !trimmed.includes('=>') && !trimmed.includes('{')) {
        const eqIdx = trimmed.indexOf('=');
        result.push(trimmed.substring(0, eqIdx).trimEnd() + ';');
        continue;
      }

      result.push(line);
      continue;
    }

    if (/^\s*(?:export\s+)?(?:abstract\s+)?class\s+\w+/.test(trimmed)) {
      state = 'class-body';
      braceDepth = (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
      result.push(line);
      if (braceDepth <= 0) state = 'normal';
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}
