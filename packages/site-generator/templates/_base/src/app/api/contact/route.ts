import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { config } from '@/lib/config'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { name, phone, message } = await request.json()

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
    }

    await resend.emails.send({
      from: `${config.businessName} Site <onboarding@resend.dev>`,
      to: config.contactEmail,
      subject: `New Lead: ${name} — ${phone}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Message:</strong> ${message || 'No message provided'}</p>
        <hr />
        <p style="color: #666; font-size: 12px;">
          Sent from ${config.businessName} website
        </p>
      `,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
