import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the base schema
let baseSchema = readFileSync(join(__dirname, 'schema.prisma'), 'utf-8');

// Split into lines
const lines = baseSchema.split('\n');
let baseEndIndex = -1;

// Find where the last enum ends (keep all enums, not just UserRole)
// Look for the last closing brace that belongs to an enum
let lastEnumEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '}' && i > 0) {
    // Check if previous lines contain an enum definition
    const prevContext = lines.slice(Math.max(0, i - 5), i).join(' ');
    if (prevContext.includes('enum ')) {
      lastEnumEnd = i + 1;
    }
  }
  // Stop if we hit a model definition (enums come before models)
  if (lines[i].trim().startsWith('model ')) {
    break;
  }
}

// If we found enum(s), keep everything up to and including the last enum
// Otherwise, keep everything up to the first model definition
if (lastEnumEnd !== -1) {
  baseEndIndex = lastEnumEnd;
} else {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('model ')) {
      baseEndIndex = i;
      break;
    }
  }
  if (baseEndIndex === -1) {
    baseEndIndex = lines.length;
  }
}

// Keep only the base configuration (generator, datasource, enum)
// Remove comment lines about imports
const baseLines = lines.slice(0, baseEndIndex).filter(line => 
  !line.includes('// Import') && 
  !line.includes('// Note:') && 
  !line.includes('// or use a build script') &&
  !line.includes('// Models are split') &&
  !line.includes('// This file contains')
);

// Read all model files
const modelFiles = [
  'schema/user.prisma',
  'schema/menu-item.prisma',
  'schema/deal.prisma',
  'schema/deal-item.prisma',
  'schema/order.prisma',
  'schema/order-line.prisma'
];

let modelsContent = '\n';

for (const modelFile of modelFiles) {
  try {
    const modelContent = readFileSync(join(__dirname, modelFile), 'utf-8');
    modelsContent += modelContent.trim() + '\n\n';
  } catch (error) {
    console.error(`Warning: Could not read ${modelFile}:`, error.message);
  }
}

// Combine base schema with models
const mergedSchema = baseLines.join('\n') + modelsContent;

// Write the merged schema back to schema.prisma
writeFileSync(join(__dirname, 'schema.prisma'), mergedSchema);
console.log('✓ Schema merged successfully!');

