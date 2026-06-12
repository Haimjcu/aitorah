import { groq } from 'next-sanity'

export const allBlogPostsQuery = groq`
  *[_type == "blogPost" && defined(publishedAt) && publishedAt <= now()]
  | order(publishedAt desc) {
    _id, title, slug, publishedAt, excerpt,
    "coverImageUrl": coverImage.asset->url,
    "authorName": author->name,
    "categories": categories[]->title
  }
`

export const blogPostBySlugQuery = groq`
  *[_type == "blogPost" && slug.current == $slug][0] {
    _id, title, slug, publishedAt, body, excerpt,
    "coverImageUrl": coverImage.asset->url,
    author->{ name, image, bio, title },
    "categories": categories[]->{ title, slug, color },
    seo
  }
`

export const allAppListingsQuery = groq`
  *[_type == "appListing"] | order(featured desc, name asc) {
    _id, name, slug, tagline, status,
    "logoUrl": logo.asset->url,
    "categories": categories[]->title,
    tags, url, featured
  }
`

export const upcomingEventsQuery = groq`
  *[_type == "event" && startTime > now()] | order(startTime asc) {
    _id, title, slug, startTime, endTime, type, platform, featured,
    "coverImageUrl": coverImage.asset->url,
    "speakerNames": speakers[].name
  }
`

export const resourcesByTypeQuery = groq`
  *[_type == "resource" && type == $type] | order(publishedAt desc) {
    _id, title, slug, description, type, tags, downloadUrl, githubUrl,
    author->{ name }
  }
`

export const siteSettingsQuery = groq`
  *[_type == "siteSettings"][0] {
    siteTitle, siteDescription, hero, socialLinks, announcementBanner,
    "featuredApps": featuredApps[]->{ name, slug, tagline, "logoUrl": logo.asset->url }
  }
`
