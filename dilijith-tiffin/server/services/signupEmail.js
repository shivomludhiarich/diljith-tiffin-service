import nodemailer from 'nodemailer';
export async function sendSignupCode(email, code) {
  return sendEmail(email, 'Verify your email — Diljit Tiffin Service', `Your signup verification code is ${code}. It expires in 10 minutes.\n\nEnter it on the signup page. Never share it with anyone. If you did not request this, ignore this email.`);
}
export async function sendRecoveryLink(email, link) {
  return sendEmail(email, 'Reset your password — Diljit Tiffin Service', `Choose a new password using this link within 20 minutes:\n${link}\n\nThis link works once. Never share it. If you did not request this, ignore this email; your password has not changed.`);
}
async function sendEmail(email, subject, text) {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD?.replace(/\s/g, '');
  if (!user || !pass) throw new Error('Email delivery is not configured.');
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    logger: false, debug: false,
  });
  const result = await transport.sendMail({
    from: { name: 'Diljit Tiffin Service', address: user }, to: email,
    subject, text,
  });
  if (!result.accepted?.length) throw new Error('Email was not accepted.');
}
