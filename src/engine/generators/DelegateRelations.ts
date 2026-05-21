import { GraphQLModel } from '../GraphQLParser.js';
import { toCamelCase, toCollectionName } from './helpers.js';

export class DelegateRelations {
  generateCountInIncludeCode(model: GraphQLModel): string {
    const lines: string[] = [];
    for (const rel of model.relations) {
      const targetCamel = toCamelCase(rel.target);

      if (rel.type === 'manyToOne' || rel.type === 'oneToOne') {
        if (rel.foreignKey) {
          lines.push(`          if (relField === '${rel.field}') {`);
          lines.push(`            counts['${rel.field}'] = document.${rel.foreignKey} ? 1 : 0`);
          lines.push(`          }`);
        }
      } else if (rel.isForeignKeyArray) {
        lines.push(`          if (relField === '${rel.field}') {`);
        lines.push(`            if (document.${rel.foreignKey} && Array.isArray(document.${rel.foreignKey}) && document.${rel.foreignKey}.length > 0) {`);
        lines.push(`              counts['${rel.field}'] = await this.client.${targetCamel}.count({ where: { id: { in: document.${rel.foreignKey} } } });`);
        lines.push(`            } else {`);
        lines.push(`              counts['${rel.field}'] = 0`);
        lines.push(`            }`);
        lines.push(`          }`);
      } else if (rel.foreignKey && rel.type === 'manyToMany' && rel.joinCollection) {
        lines.push(`          if (relField === '${rel.field}') {`);
        lines.push(`            counts['${rel.field}'] = await RelationResolver.countManyToMany(`);
        lines.push(`              this.client.$db,`);
        lines.push(`              '${model.collectionName}',`);
        lines.push(`              '${toCollectionName(rel.target)}',`);
        lines.push(`              '${rel.joinCollection}',`);
        lines.push(`              document.id`);
        lines.push(`            );`);
        lines.push(`          }`);
      } else if (rel.foreignKey) {
        lines.push(`          if (relField === '${rel.field}') {`);
        lines.push(`            counts['${rel.field}'] = await this.client.${targetCamel}.count({ where: { ${rel.foreignKey}: document.id } });`);
        lines.push(`          }`);
      }
    }
    return lines.join('\n');
  }

  generateRelationInclusionCode(model: GraphQLModel): string {
    const lines: string[] = [];

    for (const relation of model.relations) {
      if (relation.strategy === 'lookup') {
        lines.push(`    // Relation: ${relation.field} (${relation.type}) - lookup strategy`);
        lines.push(`    if (include.${relation.field} !== undefined) {`);
        lines.push(`      const includeOpts = include.${relation.field};`);
        lines.push(`      let whereFilter = {};`);
        lines.push(`      let sort = null;`);
        lines.push(`      let skip = null;`);
        lines.push(`      let limit = null;`);
        lines.push(`      let select = undefined;`);
        lines.push(`      let nestedInclude = undefined;`);
        lines.push(`      if (typeof includeOpts === 'object' && includeOpts !== null) {`);
        lines.push(`        whereFilter = includeOpts.where ? QueryBuilder.buildWhere(includeOpts.where) : {};`);
        lines.push(`        sort = includeOpts.orderBy ? QueryBuilder.buildSort(includeOpts.orderBy) : null;`);
        lines.push(`        skip = includeOpts.skip !== undefined ? includeOpts.skip : null;`);
        lines.push(`        limit = includeOpts.take !== undefined ? includeOpts.take : null;`);
        lines.push(`        select = includeOpts.select;`);
        lines.push(`        nestedInclude = includeOpts.include;`);
        lines.push(`      }`);

        const localField = relation.foreignKey;
        if (!localField) {
          if (relation.type === 'manyToMany' && relation.joinCollection) {
            lines.push(`      let ${relation.field}Result = await RelationResolver.resolveManyToMany(`);
            lines.push(`        this.client.$db,`);
            lines.push(`        '${model.collectionName}',`);
            lines.push(`        '${toCollectionName(relation.target)}',`);
            lines.push(`        '${relation.joinCollection}',`);
            lines.push(`        document.id,`);
            lines.push(`        whereFilter,`);
            lines.push(`        sort,`);
            lines.push(`        limit,`);
            lines.push(`        skip,`);
            lines.push(`        select`);
            lines.push(`      )`);
            lines.push(`      if (nestedInclude && ${relation.field}Result && Array.isArray(${relation.field}Result)) {`);
            lines.push(`        ${relation.field}Result = await Promise.all(${relation.field}Result.map(doc =>`);
            lines.push(`          this.client.${toCamelCase(relation.target)}.includeRelations(doc, nestedInclude)`);
            lines.push(`        ))`);
            lines.push(`      }`);
            lines.push(`      result.${relation.field} = ${relation.field}Result`);
          } else {
            lines.push(`      console.warn('lookup strategy not implemented for relation ${relation.field} without foreign key')`);
            lines.push(`      result.${relation.field} = []`);
          }
        } else if (relation.isForeignKeyArray) {
          lines.push(`      const innerPipeline = [`);
          lines.push(`        {`);
          lines.push(`          $match: {`);
          lines.push(`            $expr: {`);
          lines.push(`              $in: [`);
          lines.push(`                '$_id',`);
          lines.push(`                {`);
          lines.push(`                  $map: {`);
          lines.push(`                    input: { $ifNull: ['$$ids', []] },`);
          lines.push(`                    as: 'id',`);
          lines.push(`                    in: { $toObjectId: '$$id' }`);
          lines.push(`                  }`);
          lines.push(`                }`);
          lines.push(`              ]`);
          lines.push(`            }`);
          lines.push(`          }`);
          lines.push(`        }`);
          lines.push(`      ];`);
          lines.push(`      if (whereFilter && Object.keys(whereFilter).length > 0) {`);
          lines.push(`        innerPipeline.push({ $match: whereFilter });`);
          lines.push(`      }`);
          lines.push(`      if (sort) {`);
          lines.push(`        innerPipeline.push({ $sort: sort });`);
          lines.push(`      }`);
          lines.push(`      if (skip !== null) {`);
          lines.push(`        innerPipeline.push({ $skip: skip });`);
          lines.push(`      }`);
          lines.push(`      if (limit !== null) {`);
          lines.push(`        innerPipeline.push({ $limit: limit });`);
          lines.push(`      }`);
          lines.push(`      const pipeline = [`);
          lines.push(`        { $match: { _id: document._id } },`);
          lines.push(`        { $lookup: {`);
          lines.push(`          from: '${toCollectionName(relation.target)}',`);
          lines.push(`          let: { ids: '$${localField}' },`);
          lines.push(`          pipeline: innerPipeline,`);
          lines.push(`          as: '${relation.field}_lookup'`);
          lines.push(`        } }`);
          lines.push(`      ];`);
          lines.push(`      const aggResult = await this.collection.aggregate(pipeline).toArray()`);
          lines.push(`      if (aggResult.length > 0) {`);
          lines.push(`        let ${relation.field}Result = aggResult[0].${relation.field}_lookup`);
          lines.push(`        if (nestedInclude && ${relation.field}Result) {`);
          lines.push(`          if (Array.isArray(${relation.field}Result)) {`);
          lines.push(`            ${relation.field}Result = await Promise.all(${relation.field}Result.map(doc =>`);
          lines.push(`              this.client.${toCamelCase(relation.target)}.includeRelations(doc, nestedInclude)`);
          lines.push(`            ))`);
          lines.push(`          } else {`);
          lines.push(`            ${relation.field}Result = await this.client.${toCamelCase(relation.target)}.includeRelations(${relation.field}Result, nestedInclude)`);
          lines.push(`          }`);
          lines.push(`        }`);
          lines.push(`        result.${relation.field} = ${relation.field}Result`);
          lines.push(`      } else {`);
          lines.push(`        result.${relation.field} = []`);
          lines.push(`      }`);
        } else {
          lines.push(`      const innerPipeline = [`);
          lines.push(`        {`);
          lines.push(`          $match: {`);
          lines.push(`            $expr: {`);
          lines.push(`              $eq: [`);
          lines.push(`                '$_id',`);
          lines.push(`                { $toObjectId: '$$localId' }`);
          lines.push(`              ]`);
          lines.push(`            }`);
          lines.push(`          }`);
          lines.push(`        }`);
          lines.push(`      ];`);
          lines.push(`      if (whereFilter && Object.keys(whereFilter).length > 0) {`);
          lines.push(`        innerPipeline.push({ $match: whereFilter });`);
          lines.push(`      }`);
          lines.push(`      if (sort) {`);
          lines.push(`        innerPipeline.push({ $sort: sort });`);
          lines.push(`      }`);
          lines.push(`      if (skip !== null) {`);
          lines.push(`        innerPipeline.push({ $skip: skip });`);
          lines.push(`      }`);
          lines.push(`      if (limit !== null) {`);
          lines.push(`        innerPipeline.push({ $limit: limit });`);
          lines.push(`      }`);
          lines.push(`      const pipeline = [`);
          lines.push(`        { $match: { _id: document._id } },`);
          lines.push(`        { $lookup: {`);
          lines.push(`          from: '${toCollectionName(relation.target)}',`);
          lines.push(`          let: { localId: '$${localField}' },`);
          lines.push(`          pipeline: innerPipeline,`);
          lines.push(`          as: '${relation.field}_lookup'`);
          lines.push(`        } }`);
          lines.push(`      ];`);
          const needUnwind = relation.type === 'oneToOne' || relation.type === 'manyToOne';
          if (needUnwind) {
            lines.push(`        pipeline.push({ $unwind: { path: '$${relation.field}_lookup', preserveNullAndEmptyArrays: true } });`);
          }
          lines.push(`      const aggResult = await this.collection.aggregate(pipeline).toArray()`);
          lines.push(`      if (aggResult.length > 0) {`);
          lines.push(`        let ${relation.field}Result = aggResult[0].${relation.field}_lookup`);
          lines.push(`        if (nestedInclude && ${relation.field}Result) {`);
          lines.push(`          if (Array.isArray(${relation.field}Result)) {`);
          lines.push(`            ${relation.field}Result = await Promise.all(${relation.field}Result.map(doc =>`);
          lines.push(`              this.client.${toCamelCase(relation.target)}.includeRelations(doc, nestedInclude)`);
          lines.push(`            ))`);
          lines.push(`          } else {`);
          lines.push(`            ${relation.field}Result = await this.client.${toCamelCase(relation.target)}.includeRelations(${relation.field}Result, nestedInclude)`);
          lines.push(`          }`);
          lines.push(`        }`);
          lines.push(`        result.${relation.field} = ${relation.field}Result`);
          lines.push(`      } else {`);
          lines.push(`        result.${relation.field} = ${needUnwind ? 'null' : '[]'}`);
          lines.push(`      }`);
        }
        lines.push(`    }`);
      } else {
        switch (relation.type) {
          case 'oneToMany':
            lines.push(`    // Relation: ${relation.field} (oneToMany) - populate strategy`);
            lines.push(`    if (include.${relation.field} !== undefined) {`);
            lines.push(`      const includeOpts = include.${relation.field};`);
            lines.push(`      let whereFilter = {};`);
            lines.push(`      let orderBy = null;`);
            lines.push(`      let take = null;`);
            lines.push(`      let skip = null;`);
            lines.push(`      let select = undefined;`);
            lines.push(`      let nestedInclude = undefined;`);
            lines.push(`      if (typeof includeOpts === 'object' && includeOpts !== null) {`);
            lines.push(`        whereFilter = includeOpts.where || {};`);
            lines.push(`        orderBy = includeOpts.orderBy || null;`);
            lines.push(`        take = includeOpts.take !== undefined ? includeOpts.take : null;`);
            lines.push(`        skip = includeOpts.skip !== undefined ? includeOpts.skip : null;`);
            lines.push(`        select = includeOpts.select;`);
            lines.push(`        nestedInclude = includeOpts.include;`);
            lines.push(`      }`);
            if (relation.foreignKeyLocation === 'source') {
              lines.push(`      if (document.${relation.foreignKey} && Array.isArray(document.${relation.foreignKey})) {`);
              lines.push(`        const baseWhere = { id: { in: document.${relation.foreignKey} } };`);
              lines.push(`        const finalWhere = Object.keys(whereFilter).length > 0 ? { AND: [baseWhere, whereFilter] } : baseWhere;`);
              lines.push(`        const ${relation.field} = await this.client.${toCamelCase(relation.target)}.findMany({`);
              lines.push(`          where: finalWhere,`);
              lines.push(`          orderBy: orderBy,`);
              lines.push(`          take: take,`);
              lines.push(`          skip: skip,`);
              lines.push(`          select: select,`);
              lines.push(`          include: nestedInclude`);
              lines.push(`        })`);
              lines.push(`        result.${relation.field} = ${relation.field}`);
              lines.push(`      } else {`);
              lines.push(`        result.${relation.field} = []`);
              lines.push(`      }`);
            } else {
              lines.push(`      const baseWhere = { ${relation.foreignKey}: document.id };`);
              lines.push(`      const finalWhere = Object.keys(whereFilter).length > 0 ? { AND: [baseWhere, whereFilter] } : baseWhere;`);
              lines.push(`      const ${relation.field} = await this.client.${toCamelCase(relation.target)}.findMany({`);
              lines.push(`        where: finalWhere,`);
              lines.push(`        orderBy: orderBy,`);
              lines.push(`        take: take,`);
              lines.push(`        skip: skip,`);
              lines.push(`        include: nestedInclude`);
              lines.push(`      })`);
              lines.push(`      result.${relation.field} = ${relation.field}`);
            }
            lines.push(`    }`);
            break;
          case 'manyToOne':
            lines.push(`    // Relation: ${relation.field} (manyToOne) - populate strategy`);
            lines.push(`    if (include.${relation.field} !== undefined && document.${relation.foreignKey}) {`);
            lines.push(`      const includeOpts = include.${relation.field};`);
            lines.push(`      let whereFilter = {};`);
            lines.push(`      let select = undefined;`);
            lines.push(`      let nestedInclude = undefined;`);
            lines.push(`      if (typeof includeOpts === 'object' && includeOpts !== null) {`);
            lines.push(`        whereFilter = includeOpts.where || {};`);
            lines.push(`        select = includeOpts.select;`);
            lines.push(`        nestedInclude = includeOpts.include;`);
            lines.push(`      }`);
            lines.push(`      const baseWhere = { id: document.${relation.foreignKey} };`);
            lines.push(`      const finalWhere = Object.keys(whereFilter).length > 0 ? { AND: [baseWhere, whereFilter] } : baseWhere;`);
            lines.push(`      const ${relation.field} = await this.client.${toCamelCase(relation.target)}.findUnique({`);
            lines.push(`        where: finalWhere,`);
            lines.push(`        select: select,`);
            lines.push(`        include: nestedInclude`);
            lines.push(`      })`);
            lines.push(`      result.${relation.field} = ${relation.field}`);
            lines.push(`    }`);
            break;
          case 'oneToOne':
            lines.push(`    // Relation: ${relation.field} (oneToOne) - populate strategy`);
            lines.push(`    if (include.${relation.field} !== undefined && document.${relation.foreignKey}) {`);
            lines.push(`      const includeOpts = include.${relation.field};`);
            lines.push(`      let whereFilter = {};`);
            lines.push(`      let select = undefined;`);
            lines.push(`      let nestedInclude = undefined;`);
            lines.push(`      if (typeof includeOpts === 'object' && includeOpts !== null) {`);
            lines.push(`        whereFilter = includeOpts.where || {};`);
            lines.push(`        select = includeOpts.select;`);
            lines.push(`        nestedInclude = includeOpts.include;`);
            lines.push(`      }`);
            lines.push(`      const baseWhere = { id: document.${relation.foreignKey} };`);
            lines.push(`      const finalWhere = Object.keys(whereFilter).length > 0 ? { AND: [baseWhere, whereFilter] } : baseWhere;`);
            lines.push(`      const ${relation.field} = await this.client.${toCamelCase(relation.target)}.findUnique({`);
            lines.push(`        where: finalWhere,`);
            lines.push(`        select: select,`);
            lines.push(`        include: nestedInclude`);
            lines.push(`      })`);
            lines.push(`      result.${relation.field} = ${relation.field}`);
            lines.push(`    }`);
            break;
          case 'manyToMany':
            lines.push(`    // Relation: ${relation.field} (manyToMany) - populate strategy`);
            lines.push(`    if (include.${relation.field} !== undefined) {`);
            lines.push(`      const includeOpts = include.${relation.field};`);
            lines.push(`      let whereFilter = {};`);
            lines.push(`      let orderBy = null;`);
            lines.push(`      let take = null;`);
            lines.push(`      let skip = null;`);
            lines.push(`      let select = undefined;`);
            lines.push(`      let nestedInclude = undefined;`);
            lines.push(`      if (typeof includeOpts === 'object' && includeOpts !== null) {`);
            lines.push(`        whereFilter = includeOpts.where || {};`);
            lines.push(`        orderBy = includeOpts.orderBy || null;`);
            lines.push(`        take = includeOpts.take !== undefined ? includeOpts.take : null;`);
            lines.push(`        skip = includeOpts.skip !== undefined ? includeOpts.skip : null;`);
            lines.push(`        select = includeOpts.select;`);
            lines.push(`        nestedInclude = includeOpts.include;`);
            lines.push(`      }`);
            if (relation.foreignKey) {
              lines.push(`      if (document.${relation.foreignKey} && Array.isArray(document.${relation.foreignKey})) {`);
              lines.push(`        const baseWhere = { id: { in: document.${relation.foreignKey} } };`);
              lines.push(`        const finalWhere = Object.keys(whereFilter).length > 0 ? { AND: [baseWhere, whereFilter] } : baseWhere;`);
              lines.push(`        const ${relation.field} = await this.client.${toCamelCase(relation.target)}.findMany({`);
              lines.push(`          where: finalWhere,`);
              lines.push(`          orderBy: orderBy,`);
              lines.push(`          take: take,`);
              lines.push(`          skip: skip,`);
              lines.push(`          select: select,`);
              lines.push(`          include: nestedInclude`);
              lines.push(`        })`);
              lines.push(`        result.${relation.field} = ${relation.field}`);
              lines.push(`      } else {`);
              lines.push(`        result.${relation.field} = []`);
              lines.push(`      }`);
            } else if (relation.joinCollection) {
              lines.push(`      let mongoWhere = {};`);
              lines.push(`      let mongoSort = null;`);
              lines.push(`      if (Object.keys(whereFilter).length > 0) {`);
              lines.push(`        mongoWhere = QueryBuilder.buildWhere(whereFilter);`);
              lines.push(`      }`);
              lines.push(`      if (orderBy) {`);
              lines.push(`        mongoSort = QueryBuilder.buildSort(orderBy);`);
              lines.push(`      }`);
              lines.push(`      const ${relation.field} = await RelationResolver.resolveManyToMany(`);
              lines.push(`        this.client.$db,`);
              lines.push(`        '${model.collectionName}',`);
              lines.push(`        '${toCollectionName(relation.target)}',`);
              lines.push(`        '${relation.joinCollection}',`);
              lines.push(`        document.id,`);
              lines.push(`        mongoWhere,`);
              lines.push(`        mongoSort,`);
              lines.push(`        take,`);
              lines.push(`        skip,`);
              lines.push(`        select`);
              lines.push(`      )`);
              lines.push(`      result.${relation.field} = ${relation.field}`);
            } else {
              lines.push(`      console.warn('manyToMany relation ${relation.field} has no foreign key or join collection')`);
              lines.push(`      result.${relation.field} = []`);
            }
            lines.push(`    }`);
            break;
        }
      }
    }

    if (lines.length === 0) return '';
    return lines.join('\n');
  }
}
