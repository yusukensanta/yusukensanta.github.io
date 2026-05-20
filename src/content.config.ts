import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

const projectSchema = z.object({
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  repo: z.string(),
  stars: z.number().default(0),
  forks: z.number().default(0),
  homepage: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  logo_dark: z.string().nullable().optional(),
  tech_stack: z.array(z.string()).default([]),
  last_updated: z.string(),
  sections: z.object({
    readme: z.string().default(''),
    installation: z.string().default(''),
    contributing: z.string().default(''),
    changelog: z.string().default(''),
  }),
});

export type Project = z.infer<typeof projectSchema>;

const projects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/projects' }),
  schema: projectSchema,
});

export const collections = { projects };
