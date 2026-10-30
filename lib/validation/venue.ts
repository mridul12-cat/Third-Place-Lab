import { z } from 'zod';
export const venueSchema = z.object({
  name: z.string().trim().min(2).max(100), type: z.enum(['Café','Bookstore','Art space','Community venue','Other']),
  city: z.string().trim().max(100).default(''), personality: z.string().trim().min(3).max(600),
  audience: z.string().trim().min(3).max(500), interests: z.array(z.string().trim().min(1).max(100)).min(1).max(6).transform(values=>Array.from(new Map(values.map(v=>[v.normalize('NFKC').toLowerCase().replace(/\s+/g,' '),v])).values())),
  atmosphere: z.enum(['Slow & cozy','Playful & creative','Lively & social']), budget: z.number().int().min(100).max(1000000),
  capacity: z.number().int().min(2).max(200), format: z.enum(['Open to possibilities','Conversation','Creative workshop','Listening session']),
  constraints: z.string().max(600).default(''), currency: z.literal('INR').default('INR'),
}).strict();
export type VenueProfile = z.infer<typeof venueSchema>;
export const refinementSchema = z.enum(['cheaper','intimate','larger','family','direction','surprise','context']);
export type RefinementRequest = z.infer<typeof refinementSchema>;
