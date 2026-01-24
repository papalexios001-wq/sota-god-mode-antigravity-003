// =============================================================================
// SOTA SEMANTIC ENTITY GRAPH ENGINE v1.0
// Enterprise-Grade Knowledge Graph & Entity Optimization for AEO/GEO
// =============================================================================

// ==================== ENTITY INTERFACES ====================

export interface SemanticEntity {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  aliases: string[];
  wikidataId?: string;
  wikipediaUrl?: string;
  properties: Record<string, any>;
  relationships: EntityRelationship[];
}

export type EntityType = 
  | 'Person' | 'Organization' | 'Product' | 'Place' | 'Event'
  | 'Concept' | 'CreativeWork' | 'Brand' | 'Technology' | 'Service';

export interface EntityRelationship {
  type: RelationType;
  targetEntityId: string;
  targetEntityName: string;
  confidence: number;
}

export type RelationType = 
  | 'isA' | 'partOf' | 'createdBy' | 'locatedIn' | 'relatedTo'
  | 'competitorOf' | 'alternativeTo' | 'usedFor' | 'requiredBy';

export interface EntityContext {
  primaryEntity: SemanticEntity;
  relatedEntities: SemanticEntity[];
  entityDensityScore: number;
  topicRelevanceScore: number;
}

// ==================== ENTITY EXTRACTION PROMPT ====================

export const ENTITY_EXTRACTION_INSTRUCTIONS = `
===============================================================================
SEMANTIC ENTITY GRAPH OPTIMIZATION - ENTERPRISE GRADE v1.0
===============================================================================

🎯 ENTITY-FIRST CONTENT ARCHITECTURE:

1. IDENTIFY CORE ENTITIES (5-10 per article):
   - Primary Topic Entity (the main subject)
   - Supporting Entities (related people, places, products)
   - Contextual Entities (industry, technology, concepts)

2. ENTITY RELATIONSHIP MAPPING:
   - Define clear relationships between entities
   - Use consistent entity naming throughout
   - Link entities to authoritative sources

3. ENTITY SCHEMA REQUIREMENTS:
   - Include Schema.org @type for each entity
   - Add sameAs links to Wikipedia/Wikidata when applicable
   - Use consistent canonical names

4. ENTITY DENSITY OPTIMIZATION:
   - Mention primary entity 8-12 times naturally
   - Include entity variations and synonyms
   - Use entity-rich anchor text for internal links

❗ ENTITY DISAMBIGUATION:
- Clarify ambiguous entities (Apple = company, not fruit)
- Use context clues in first mention
- Link to authoritative entity pages
`;

// ==================== SCHEMA.ORG ENTITY TYPES ====================

export const SCHEMA_ENTITY_TYPES: Record<EntityType, string> = {
  Person: 'https://schema.org/Person',
  Organization: 'https://schema.org/Organization',
  Product: 'https://schema.org/Product',
  Place: 'https://schema.org/Place',
  Event: 'https://schema.org/Event',
  Concept: 'https://schema.org/Thing',
  CreativeWork: 'https://schema.org/CreativeWork',
  Brand: 'https://schema.org/Brand',
  Technology: 'https://schema.org/SoftwareApplication',
  Service: 'https://schema.org/Service',
};

// ==================== GENERATE ENTITY SCHEMA ====================

export function generateEntitySchema(entity: SemanticEntity): Record<string, any> {
  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": entity.type,
    "name": entity.name,
    "description": entity.description,
  };

  if (entity.aliases.length > 0) {
    schema.alternateName = entity.aliases;
  }

  if (entity.wikidataId) {
    schema.sameAs = schema.sameAs || [];
    schema.sameAs.push(`https://www.wikidata.org/wiki/${entity.wikidataId}`);
  }

  if (entity.wikipediaUrl) {
    schema.sameAs = schema.sameAs || [];
    schema.sameAs.push(entity.wikipediaUrl);
  }

  // Add type-specific properties
  Object.entries(entity.properties).forEach(([key, value]) => {
    schema[key] = value;
  });

  return schema;
}

// ==================== GENERATE MENTIONS GRAPH SCHEMA ====================

export function generateMentionsGraphSchema(
  entities: SemanticEntity[],
  articleUrl: string
): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "url": articleUrl,
    "mentions": entities.map(entity => ({
      "@type": entity.type,
      "name": entity.name,
      ...(entity.wikidataId && {
        "sameAs": `https://www.wikidata.org/wiki/${entity.wikidataId}`
      })
    })),
    "about": entities.length > 0 ? {
      "@type": entities[0].type,
      "name": entities[0].name,
    } : undefined
  };
}

// ==================== ENTITY DISAMBIGUATION ====================

export const COMMON_AMBIGUOUS_ENTITIES: Record<string, { meanings: string[], disambiguationHint: string }> = {
  "Apple": {
    meanings: ["Technology company", "Fruit"],
    disambiguationHint: "Apple Inc., the technology company" 
  },
  "Amazon": {
    meanings: ["E-commerce company", "River", "Rainforest"],
    disambiguationHint: "Amazon.com, the e-commerce and cloud computing company"
  },
  "Python": {
    meanings: ["Programming language", "Snake"],
    disambiguationHint: "Python, the programming language"
  },
  "Java": {
    meanings: ["Programming language", "Island", "Coffee"],
    disambiguationHint: "Java, the programming language developed by Sun Microsystems"
  },
  "Oracle": {
    meanings: ["Database company", "Ancient prophet"],
    disambiguationHint: "Oracle Corporation, the database and cloud computing company"
  },
};

// ==================== CALCULATE ENTITY DENSITY ====================

export function calculateEntityDensity(
  content: string,
  entities: SemanticEntity[]
): { entity: string; count: number; density: number }[] {
  const wordCount = content.split(/\s+/).length;
  
  return entities.map(entity => {
    const regex = new RegExp(`\\b${entity.name}\\b`, 'gi');
    const matches = content.match(regex) || [];
    const count = matches.length;
    const density = (count / wordCount) * 100;
    
    return {
      entity: entity.name,
      count,
      density: Math.round(density * 100) / 100
    };
  });
}

// ==================== ENTITY LINKING HTML ====================

export function generateEntityLinkHTML(
  entityName: string,
  entityType: EntityType,
  wikipediaUrl?: string
): string {
  if (wikipediaUrl) {
    return `<a href="${wikipediaUrl}" target="_blank" rel="noopener" class="sota-entity-link" data-entity-type="${entityType}">${entityName}</a>`;
  }
  return `<span class="sota-entity" data-entity-type="${entityType}">${entityName}</span>`;
}

// ==================== DEFAULT EXPORT ====================

export default {
  ENTITY_EXTRACTION_INSTRUCTIONS,
  SCHEMA_ENTITY_TYPES,
  COMMON_AMBIGUOUS_ENTITIES,
  generateEntitySchema,
  generateMentionsGraphSchema,
  calculateEntityDensity,
  generateEntityLinkHTML,
};
