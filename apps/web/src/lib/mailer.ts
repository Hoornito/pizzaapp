import nodemailer from 'nodemailer';

const globalForMailer = globalThis as unknown as {
  transporter: nodemailer.Transporter | undefined;
};

function createTransporter(): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export const transporter = globalForMailer.transporter ?? createTransporter();

if (process.env.NODE_ENV !== 'production') globalForMailer.transporter = transporter;

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<void> {
  await transporter.sendMail({
    from: options.from || process.env.SMTP_FROM || 'Pizzería <noreply@pizzeria.com>',
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}
