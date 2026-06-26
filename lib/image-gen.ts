import OpenAI from 'openai'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

let _s3: S3Client | null = null
function getR2() {
  if (!_s3) {
    _s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  }
  return _s3
}

export async function generateFeaturedImage(
  question: string,
  categories: string[] | null,
  slug: string,
): Promise<string | null> {
  try {
    const categoryHint = categories?.slice(0, 2).join(', ') ?? 'Torah'

    const prompt = [
      `A beautiful, dignified illustration for a Torah study article about: "${question}".`,
      `Category: ${categoryHint}.`,
      'Style: warm golden tones, soft lighting, classic Jewish art aesthetic.',
      'Include subtle visual elements like Torah scrolls, ancient texts, menorahs, or olive branches where fitting.',
      'No text, no letters, no words in the image.',
      'Photorealistic painting style, 16:9 aspect ratio composition.',
    ].join(' ')

    const response = await getOpenAI().images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1536x1024',
      quality: 'medium',
    })

    const b64 = response.data?.[0]?.b64_json
    if (!b64) return null

    const raw = Buffer.from(b64, 'base64')
    const compressed = await sharp(raw)
      .resize(1200, 800, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer()
    const copy = new ArrayBuffer(compressed.byteLength)
    new Uint8Array(copy).set(new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength))
    const body = new Uint8Array(copy)
    const key = `qa/${slug}.webp`

    await getR2().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: body,
      ContentType: 'image/webp',
    }))

    const publicDomain = process.env.R2_PUBLIC_URL
    return `${publicDomain}/${key}`
  } catch (error) {
    console.error('Image generation failed:', error)
    return null
  }
}
