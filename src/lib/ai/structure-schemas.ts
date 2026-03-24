import { z } from 'zod'

export const StructureCategorySchema = z.object({
  name: z.string().describe('Human-readable category name'),
  slug: z.string().describe('URL-safe slug for the category'),
  isCore: z.boolean().describe('Whether this is a core category (Ramp, Card Draw, etc.)'),
  target: z.number().int().min(0).describe('Recommended number of cards'),
  currentCount: z.number().int().min(0).describe('Current count in deck'),
  rating: z.enum(['excessive', 'strong', 'adequate', 'low', 'deficient']),
  notes: z.string().describe('AI notes about this category. Wrap card names in [[double brackets]].'),
})

export const StructureStrategySchema = z.object({
  categories: z.array(StructureCategorySchema).describe('All categories for this deck'),
  landTarget: z.number().int().min(0).describe('Recommended land count'),
  summary: z.string().describe('2-3 sentence structure health overview'),
  gapAnalysis: z.string().describe('What the deck is missing structurally'),
})

export const CardAssignmentSchema = z.object({
  cardName: z.string(),
  categories: z.array(z.string()).describe('Category slugs this card belongs to'),
})

export const StructureAssignmentSchema = z.object({
  assignments: z.array(CardAssignmentSchema).describe('Non-land card assignments'),
  landAssignments: z.array(CardAssignmentSchema).describe('Land card assignments (all get "lands" as primary)'),
  unassignable: z.array(z.string()).default([]).describe('Cards that truly have no role (should be empty)'),
})

export type StructureStrategy = z.infer<typeof StructureStrategySchema>
export type StructureAssignment = z.infer<typeof StructureAssignmentSchema>
export type StructureCategory = z.infer<typeof StructureCategorySchema>
