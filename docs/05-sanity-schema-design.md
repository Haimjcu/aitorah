# Sanity Schema Design — AI Torah

## 1. Overview

Sanity manages all editorial content that non-developer contributors need to publish without touching code. The Next.js app fetches this content via GROQ queries.

**Content types defined:**
1. `blogPost` — articles, announcements, thought leadership
2. `appListing` — curated directory of Jewish AI apps
3. `event` — webinars, workshops, interactive lectures
4. `resource` — open-source files, blueprints, documentation pages
5. `author` — shared author profiles referenced by blog posts
6. `category` — taxonomy shared across blog, apps, and resources
7. `siteSettings` — singleton for homepage hero, nav CTAs, footer links

---

## 2. Schema Definitions

All schema files live in `sanity/schemas/`.

### 2.1 `blogPost.ts`
```typescript
import { defineField, defineType } from 'sanity'

export const blogPost = defineType({
  name: 'blogPost',
  title: 'Blog Post',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', validation: r => r.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title' }, validation: r => r.required() }),
    defineField({ name: 'author', type: 'reference', to: [{ type: 'author' }] }),
    defineField({ name: 'publishedAt', type: 'datetime', validation: r => r.required() }),
    defineField({ name: 'excerpt', type: 'text', rows: 3 }),
    defineField({ name: 'coverImage', type: 'image', options: { hotspot: true } }),
    defineField({
      name: 'categories',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'category' }] }],
    }),
    defineField({
      name: 'body',
      type: 'array',
      of: [
        { type: 'block' },  // rich text
        { type: 'image', options: { hotspot: true } },
        {
          type: 'object',
          name: 'codeBlock',
          fields: [
            { name: 'language', type: 'string' },
            { name: 'code', type: 'text' },
          ],
        },
        {
          type: 'object',
          name: 'torahQuote',
          title: 'Torah Quote',
          fields: [
            { name: 'hebrewText', type: 'text' },
            { name: 'englishText', type: 'text' },
            { name: 'reference', type: 'string', description: 'e.g. Pirkei Avot 1:1' },
            { name: 'commentary', type: 'text' },
          ],
        },
      ],
    }),
    defineField({ name: 'featured', type: 'boolean', initialValue: false }),
    defineField({
      name: 'seo',
      type: 'object',
      fields: [
        { name: 'metaTitle', type: 'string' },
        { name: 'metaDescription', type: 'text', rows: 2 },
        { name: 'ogImage', type: 'image' },
      ],
    }),
  ],
  preview: {
    select: { title: 'title', media: 'coverImage', date: 'publishedAt' },
    prepare: ({ title, media, date }) => ({
      title,
      subtitle: date ? new Date(date).toLocaleDateString() : 'Unpublished',
      media,
    }),
  },
  orderings: [{ title: 'Published Date, Newest', name: 'publishedAtDesc', by: [{ field: 'publishedAt', direction: 'desc' }] }],
})
```

---

### 2.2 `appListing.ts`
```typescript
export const appListing = defineType({
  name: 'appListing',
  title: 'App Directory Listing',
  type: 'document',
  fields: [
    defineField({ name: 'name', type: 'string', validation: r => r.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'name' }, validation: r => r.required() }),
    defineField({ name: 'tagline', type: 'string', description: 'One-line description (max 120 chars)' }),
    defineField({ name: 'description', type: 'array', of: [{ type: 'block' }] }),
    defineField({ name: 'logo', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'screenshots', type: 'array', of: [{ type: 'image', options: { hotspot: true } }] }),
    defineField({ name: 'url', type: 'url' }),
    defineField({ name: 'githubUrl', type: 'url' }),
    defineField({
      name: 'categories',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'category' }] }],
    }),
    defineField({
      name: 'tags',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: 'e.g. LangChain, ChatGPT, Halacha, Sefaria',
    }),
    defineField({
      name: 'status',
      type: 'string',
      options: { list: ['live', 'beta', 'open-source', 'archived'], layout: 'radio' },
      initialValue: 'live',
    }),
    defineField({ name: 'creator', type: 'string', description: 'Creator name or organization' }),
    defineField({ name: 'submittedAt', type: 'datetime' }),
    defineField({ name: 'featured', type: 'boolean', initialValue: false }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'tagline', media: 'logo' },
  },
})
```

---

### 2.3 `event.ts`
```typescript
export const event = defineType({
  name: 'event',
  title: 'Event',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', validation: r => r.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title' }, validation: r => r.required() }),
    defineField({ name: 'description', type: 'array', of: [{ type: 'block' }] }),
    defineField({ name: 'coverImage', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'startTime', type: 'datetime', validation: r => r.required() }),
    defineField({ name: 'endTime', type: 'datetime' }),
    defineField({
      name: 'type',
      type: 'string',
      options: { list: ['webinar', 'workshop', 'interactive-lecture', 'hackathon', 'shiur'], layout: 'dropdown' },
      validation: r => r.required(),
    }),
    defineField({
      name: 'platform',
      type: 'string',
      options: { list: ['zoom', 'discord', 'youtube-live', 'in-person'], layout: 'dropdown' },
    }),
    defineField({ name: 'registrationUrl', type: 'url' }),
    defineField({ name: 'streamUrl', type: 'url', description: 'Live stream link (revealed at event time)' }),
    defineField({ name: 'recordingUrl', type: 'url', description: 'Post-event recording' }),
    defineField({
      name: 'speakers',
      type: 'array',
      of: [{
        type: 'object',
        fields: [
          { name: 'name', type: 'string' },
          { name: 'bio', type: 'text', rows: 2 },
          { name: 'image', type: 'image' },
          { name: 'title', type: 'string' },
        ],
      }],
    }),
    defineField({ name: 'featured', type: 'boolean', initialValue: false }),
    defineField({ name: 'categories', type: 'array', of: [{ type: 'reference', to: [{ type: 'category' }] }] }),
  ],
  preview: {
    select: { title: 'title', date: 'startTime', media: 'coverImage' },
    prepare: ({ title, date, media }) => ({
      title,
      subtitle: date ? new Date(date).toLocaleString() : 'No date set',
      media,
    }),
  },
  orderings: [{ title: 'Start Time, Soonest', name: 'startTimeAsc', by: [{ field: 'startTime', direction: 'asc' }] }],
})
```

---

### 2.4 `resource.ts`
```typescript
export const resource = defineType({
  name: 'resource',
  title: 'Resource',
  type: 'document',
  description: 'Open-source files, blueprints, documentation, technical guides',
  fields: [
    defineField({ name: 'title', type: 'string', validation: r => r.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title' }, validation: r => r.required() }),
    defineField({ name: 'description', type: 'text', rows: 3 }),
    defineField({
      name: 'type',
      type: 'string',
      options: {
        list: ['documentation', 'blueprint', 'dataset', 'tool', 'tutorial', 'research-paper'],
        layout: 'dropdown',
      },
      validation: r => r.required(),
    }),
    defineField({
      name: 'body',
      type: 'array',
      of: [
        { type: 'block' },
        { type: 'image', options: { hotspot: true } },
        {
          type: 'object',
          name: 'codeBlock',
          fields: [
            { name: 'language', type: 'string', options: { list: ['typescript', 'python', 'bash', 'sql', 'json'] } },
            { name: 'filename', type: 'string' },
            { name: 'code', type: 'text' },
          ],
        },
      ],
    }),
    defineField({ name: 'downloadUrl', type: 'url', description: 'Direct download or GitHub link' }),
    defineField({ name: 'githubUrl', type: 'url' }),
    defineField({ name: 'author', type: 'reference', to: [{ type: 'author' }] }),
    defineField({ name: 'categories', type: 'array', of: [{ type: 'reference', to: [{ type: 'category' }] }] }),
    defineField({
      name: 'tags',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
    }),
    defineField({ name: 'publishedAt', type: 'datetime' }),
    defineField({ name: 'featured', type: 'boolean', initialValue: false }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'type' },
  },
})
```

---

### 2.5 `author.ts`
```typescript
export const author = defineType({
  name: 'author',
  title: 'Author',
  type: 'document',
  fields: [
    defineField({ name: 'name', type: 'string', validation: r => r.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'name' } }),
    defineField({ name: 'image', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'bio', type: 'text', rows: 4 }),
    defineField({ name: 'title', type: 'string', description: 'e.g. Rabbi, Developer, Scholar' }),
    defineField({ name: 'twitterHandle', type: 'string' }),
    defineField({ name: 'linkedinUrl', type: 'url' }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'title', media: 'image' },
  },
})
```

---

### 2.6 `category.ts`
```typescript
export const category = defineType({
  name: 'category',
  title: 'Category',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', validation: r => r.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title' }, validation: r => r.required() }),
    defineField({ name: 'description', type: 'text', rows: 2 }),
    defineField({ name: 'color', type: 'string', description: 'Hex color for category badge, e.g. #3b82f6' }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'description' },
  },
})
```

---

### 2.7 `siteSettings.ts`
```typescript
export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  // Singleton — only one document of this type allowed
  fields: [
    defineField({ name: 'siteTitle', type: 'string', initialValue: 'AI Torah' }),
    defineField({ name: 'siteDescription', type: 'text', rows: 2 }),
    defineField({
      name: 'hero',
      type: 'object',
      fields: [
        { name: 'headline', type: 'string' },
        { name: 'subheadline', type: 'string' },
        { name: 'ctaPrimaryText', type: 'string' },
        { name: 'ctaPrimaryUrl', type: 'string' },
        { name: 'ctaSecondaryText', type: 'string' },
        { name: 'ctaSecondaryUrl', type: 'string' },
        { name: 'backgroundImage', type: 'image' },
      ],
    }),
    defineField({
      name: 'featuredApps',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'appListing' }] }],
      description: 'Apps shown in homepage spotlight (max 3)',
      validation: r => r.max(3),
    }),
    defineField({
      name: 'socialLinks',
      type: 'object',
      fields: [
        { name: 'twitter', type: 'url' },
        { name: 'discord', type: 'url' },
        { name: 'github', type: 'url' },
        { name: 'youtube', type: 'url' },
      ],
    }),
    defineField({ name: 'announcementBanner', type: 'string', description: 'Optional top-of-site banner text' }),
  ],
})
```

---

## 3. Sanity Studio Config

```typescript
// sanity/sanity.config.ts
import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { media } from 'sanity-plugin-media'
import { blogPost } from './schemas/blogPost'
import { appListing } from './schemas/appListing'
import { event } from './schemas/event'
import { resource } from './schemas/resource'
import { author } from './schemas/author'
import { category } from './schemas/category'
import { siteSettings } from './schemas/siteSettings'

export default defineConfig({
  name: 'ai-torah',
  title: 'AI Torah Studio',
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  plugins: [
    structureTool({
      structure: (S) =>
        S.list().title('Content').items([
          S.listItem().title('Site Settings').child(
            S.document().schemaType('siteSettings').documentId('siteSettings')
          ),
          S.divider(),
          S.documentTypeListItem('blogPost').title('Blog Posts'),
          S.documentTypeListItem('appListing').title('App Directory'),
          S.documentTypeListItem('event').title('Events'),
          S.documentTypeListItem('resource').title('Resources'),
          S.divider(),
          S.documentTypeListItem('author').title('Authors'),
          S.documentTypeListItem('category').title('Categories'),
        ]),
    }),
    visionTool(),   // GROQ query explorer in Studio
    media(),        // Centralized media library
  ],
  schema: {
    types: [blogPost, appListing, event, resource, author, category, siteSettings],
  },
})
```

---

## 4. GROQ Query Reference

```typescript
// lib/sanity/queries.ts

// All published blog posts (index)
export const allBlogPostsQuery = groq`
  *[_type == "blogPost" && defined(publishedAt) && publishedAt <= now()]
  | order(publishedAt desc) {
    _id, title, slug, publishedAt, excerpt,
    "coverImageUrl": coverImage.asset->url,
    "authorName": author->name,
    "categories": categories[]->title
  }
`

// Single blog post by slug
export const blogPostBySlugQuery = groq`
  *[_type == "blogPost" && slug.current == $slug][0] {
    _id, title, slug, publishedAt, body, excerpt,
    "coverImageUrl": coverImage.asset->url,
    author->{ name, image, bio, title },
    "categories": categories[]->{ title, slug, color },
    seo
  }
`

// App directory
export const allAppListingsQuery = groq`
  *[_type == "appListing"] | order(featured desc, name asc) {
    _id, name, slug, tagline, status,
    "logoUrl": logo.asset->url,
    "categories": categories[]->title,
    tags, url, featured
  }
`

// Upcoming events
export const upcomingEventsQuery = groq`
  *[_type == "event" && startTime > now()] | order(startTime asc) {
    _id, title, slug, startTime, endTime, type, platform, featured,
    "coverImageUrl": coverImage.asset->url,
    "speakerNames": speakers[].name
  }
`

// Resources filtered by type
export const resourcesByTypeQuery = groq`
  *[_type == "resource" && type == $type] | order(publishedAt desc) {
    _id, title, slug, description, type, tags, downloadUrl, githubUrl,
    author->{ name }
  }
`

// Site settings singleton
export const siteSettingsQuery = groq`
  *[_type == "siteSettings"][0] {
    siteTitle, siteDescription, hero, socialLinks, announcementBanner,
    "featuredApps": featuredApps[]->{ name, slug, tagline, "logoUrl": logo.asset->url }
  }
`
```

---

## 5. Sanity Webhook Setup

In Sanity Studio → API → Webhooks:

| Webhook | Filter | URL | Purpose |
|---|---|---|---|
| Content revalidate | `_type in ["blogPost","appListing","event","resource","siteSettings"]` | `https://aitorah.ai/api/webhooks/sanity` | Trigger Next.js ISR revalidation |

Secret: set `SANITY_WEBHOOK_SECRET` in Railway and Sanity webhook config.
