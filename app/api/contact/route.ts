import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const ContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().optional(),
  interests: z.array(z.string()),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ContactSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { name, email, phone, message, interests } = parsed.data

    await resend.emails.send({
      from: 'AI Torah <onboarding@resend.dev>',
      to: process.env.CONTACT_EMAIL!,
      subject: `New contact: ${name}`,
      html: `
        <h2>New AI Torah Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
        ${interests.length > 0 ? `<p><strong>Interests:</strong> ${interests.join(', ')}</p>` : ''}
        ${message ? `<p><strong>Message:</strong></p><p>${message}</p>` : ''}
      `,
    })

    return Response.json({ ok: true })
  } catch (error) {
    console.error('Contact form error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
