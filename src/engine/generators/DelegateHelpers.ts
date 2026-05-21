import { GraphQLModel } from '../GraphQLParser.js';
import { toCamelCase, toCollectionName } from './helpers.js';

export class DelegateHelpers {
  generateCascadeMethod(model: GraphQLModel): string {
    const cascadeRelations = model.relations.filter(r => r.onDelete !== 'NoAction');
    if (cascadeRelations.length === 0) return '';

    const lines: string[] = [];
    lines.push(`  private async handleCascadeDelete(doc: any): Promise<void> {`);

    for (const rel of cascadeRelations) {
      lines.push(`    // Relation: ${rel.field} (${rel.type}) - onDelete: ${rel.onDelete}`);

      if (rel.onDelete === 'Cascade') {
        if (rel.isForeignKeyArray) {
          lines.push(`    if (doc.${rel.foreignKey} && Array.isArray(doc.${rel.foreignKey}) && doc.${rel.foreignKey}.length > 0) {`);
          lines.push(`      await this.client.${toCamelCase(rel.target)}.deleteMany({ where: { id: { in: doc.${rel.foreignKey} } } });`);
          lines.push(`    }`);
        } else if (rel.foreignKeyLocation === 'source' || !rel.foreignKeyLocation) {
          const isSingleResult = rel.type === 'manyToOne' || rel.type === 'oneToOne';
          lines.push(`    if (doc.${rel.foreignKey}) {`);
          if (isSingleResult) {
            lines.push(`      await this.client.${toCamelCase(rel.target)}.delete({ where: { id: doc.${rel.foreignKey} } });`);
          } else {
            lines.push(`      await this.client.${toCamelCase(rel.target)}.deleteMany({ where: { id: doc.${rel.foreignKey} } });`);
          }
          lines.push(`    }`);
        } else {
          lines.push(`    await this.client.${toCamelCase(rel.target)}.deleteMany({ where: { ${rel.foreignKey}: doc.id } });`);
        }
      } else if (rel.onDelete === 'SetNull') {
        if (rel.foreignKeyLocation === 'source' || rel.isForeignKeyArray) {
          lines.push(`    // FK '${rel.foreignKey}' is in the source document being deleted — no action needed`);
        } else {
          if (rel.isForeignKeyArray) {
            lines.push(`    await this.client.$db.collection('${toCollectionName(rel.target)}').updateMany(`);
            lines.push(`      { ${rel.foreignKey}: doc.id },`);
            lines.push(`      { $pull: { ${rel.foreignKey}: doc.id } }`);
            lines.push(`    );`);
          } else {
            lines.push(`    await this.client.${toCamelCase(rel.target)}.updateMany({`);
            lines.push(`      where: { ${rel.foreignKey}: doc.id },`);
            lines.push(`      data: { ${rel.foreignKey}: null }`);
            lines.push(`    });`);
          }
        }
      } else if (rel.onDelete === 'Restrict') {
        if (rel.isForeignKeyArray && rel.foreignKey && (rel.foreignKeyLocation === 'source' || !rel.foreignKeyLocation)) {
          lines.push(`    if (doc.${rel.foreignKey} && Array.isArray(doc.${rel.foreignKey}) && doc.${rel.foreignKey}.length > 0) {`);
          lines.push(`      throw new Error(\`Cannot delete ${model.name}: relation '${rel.field}' has \${doc.${rel.foreignKey}.length} related ${rel.target} records (Restrict constraint)\`);`);
          lines.push(`    }`);
        } else if (rel.foreignKey && (rel.foreignKeyLocation === 'source' || !rel.foreignKeyLocation)) {
          lines.push(`    if (doc.${rel.foreignKey}) {`);
          lines.push(`      throw new Error(\`Cannot delete ${model.name}: relation '${rel.field}' has related ${rel.target} records (Restrict constraint)\`);`);
          lines.push(`    }`);
        } else if (rel.foreignKey) {
          // FK on target collection — must query
          lines.push(`    const restrictCount_${rel.field} = await this.client.${toCamelCase(rel.target)}.count({ where: { ${rel.foreignKey}: doc.id } });`);
          lines.push(`    if (restrictCount_${rel.field} > 0) {`);
          lines.push(`      throw new Error(\`Cannot delete ${model.name}: relation '${rel.field}' has \${restrictCount_${rel.field}} related ${rel.target} records (Restrict constraint)\`);`);
          lines.push(`    }`);
        }
      }
    }

    lines.push(`  }`);
    return lines.join('\n');
  }

  generateCascadeUpdateMethod(model: GraphQLModel): string {
    const cascadeRelations = model.relations.filter(r => r.onUpdate && r.onUpdate !== 'NoAction');
    if (cascadeRelations.length === 0) return '';

    const lines: string[] = [];
    lines.push(`  private async handleCascadeUpdate(doc: any, oldData: any): Promise<void> {`);

    for (const rel of cascadeRelations) {
      lines.push(`    // Relation: ${rel.field} (${rel.type}) - onUpdate: ${rel.onUpdate}`);

      if (rel.onUpdate === 'Cascade') {
        if (rel.foreignKeyLocation === 'target' || (!rel.foreignKeyLocation && rel.type !== 'manyToMany')) {
          // FK is on the target collection — update child FKs when source ID changes
          lines.push(`    if (oldData.id && doc.id !== oldData.id) {`);
          lines.push(`      await this.client.${toCamelCase(rel.target)}.updateMany({`);
          lines.push(`        where: { ${rel.foreignKey}: oldData.id },`);
          lines.push(`        data: { ${rel.foreignKey}: doc.id }`);
          lines.push(`      });`);
          lines.push(`    }`);
        } else {
          lines.push(`    // FK '${rel.foreignKey}' stored in source document — no target cascade needed`);
        }
      } else if (rel.onUpdate === 'SetNull') {
        if (rel.foreignKeyLocation === 'target') {
          lines.push(`    if (oldData.${rel.foreignKey} && !doc.${rel.foreignKey}) {`);
          lines.push(`      await this.client.${toCamelCase(rel.target)}.updateMany({`);
          lines.push(`        where: { ${rel.foreignKey}: doc.id },`);
          lines.push(`        data: { ${rel.foreignKey}: null }`);
          lines.push(`      });`);
          lines.push(`    }`);
        } else {
          lines.push(`    // FK '${rel.foreignKey}' stored in source document — SetNull on update handled by FK write`);
        }
      } else if (rel.onUpdate === 'Restrict') {
        if (rel.foreignKeyLocation === 'target' || (!rel.foreignKeyLocation && rel.type !== 'manyToMany')) {
          lines.push(`    if (oldData.${rel.foreignKey} && (!doc.${rel.foreignKey} || doc.${rel.foreignKey} !== oldData.${rel.foreignKey})) {`);
          lines.push(`      const restrictCount_${rel.field} = await this.client.${toCamelCase(rel.target)}.count({ where: { ${rel.foreignKey}: oldData.id } });`);
          lines.push(`      if (restrictCount_${rel.field} > 0) {`);
          lines.push(`        throw new Error(\`Cannot update ${model.name}: relation '${rel.field}' has \${restrictCount_${rel.field}} related ${rel.target} records (Restrict constraint)\`);`);
          lines.push(`      }`);
          lines.push(`    }`);
        } else {
          lines.push(`    // FK in source — check if changed`);
          lines.push(`    if (oldData.${rel.foreignKey} && (!doc.${rel.foreignKey} || doc.${rel.foreignKey} !== oldData.${rel.foreignKey})) {`);
          lines.push(`      throw new Error(\`Cannot update ${model.name}: relation '${rel.field}' has related ${rel.target} records (Restrict constraint)\`);`);
          lines.push(`    }`);
        }
      }
    }

    lines.push(`  }`);
    return lines.join('\n');
  }

  generateValidationMethod(model: GraphQLModel): string {
    const rules: string[] = [];
    for (const field of model.fields) {
      if (!field.validationRules) continue;
      if (field.validationRules.email) {
        rules.push(`      if (data.${field.name} && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(data.${field.name})) {
        throw new Error('Validation failed: ${field.name} must be a valid email address')
      }`);
      }
      if (field.validationRules.url) {
        rules.push(`      if (data.${field.name} && !/^https?:\\/\\//.test(data.${field.name})) {
        throw new Error('Validation failed: ${field.name} must be a valid URL')
      }`);
      }
      if (field.validationRules.regex) {
        const pattern = field.validationRules.regex.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'");
        rules.push(`      if (data.${field.name} && !new RegExp('${pattern}').test(data.${field.name})) {
        throw new Error('Validation failed: ${field.name} does not match required pattern')
      }`);
      }
    }
    if (rules.length === 0) return '';
    return `
  private validateData(data: any): void {
${rules.join('\n')}
  }`;
  }
}
