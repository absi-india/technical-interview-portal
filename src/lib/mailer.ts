import nodemailer from "nodemailer";

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendInterviewInvite(
  candidateName: string,
  candidateEmail: string,
  jobTitle: string,
  inviteToken: string
) {
  const domain = process.env.APP_DOMAIN ?? "http://localhost:3000";
  const link = `${domain}/interview/${inviteToken}`;
  const from = process.env.SMTP_FROM ?? "Interview Platform <noreply@example.com>";

  await getTransport().sendMail({
    from,
    to: candidateEmail,
    subject: `Your Technical Interview Invitation — ${jobTitle}`,
    text: `Hi ${candidateName},

You have been invited to complete a technical interview for the position of ${jobTitle}.

Please use the following link to access your interview:
${link}

Important information:
- You have 30 minutes to complete the interview
- Questions are presented one at a time — you cannot go back
- A working camera and microphone are required
- Use Google Chrome or Microsoft Edge
- This link is valid for 7 days

Good luck!`,
    html: `<p>Hi <strong>${candidateName}</strong>,</p>
<p>You have been invited to complete a technical interview for the position of <strong>${jobTitle}</strong>.</p>
<p><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Start Interview</a></p>
<p>Or copy this link: <code>${link}</code></p>
<ul>
  <li>30-minute time limit, one question at a time (no going back)</li>
  <li>Camera and microphone required</li>
  <li>Chrome or Edge required</li>
  <li>Link valid for 7 days</li>
</ul>
<p>Good luck!</p>`,
  });
}

export async function sendRatingCompleteEmail(
  recruiterEmail: string,
  candidateName: string,
  overallRating: string,
  overallScore: number,
  testId: string
) {
  const domain = process.env.APP_DOMAIN ?? "http://localhost:3000";
  const from = process.env.SMTP_FROM ?? "Interview Platform <noreply@example.com>";

  await getTransport().sendMail({
    from,
    to: recruiterEmail,
    subject: `AI Rating Complete — ${candidateName}`,
    text: `AI rating is complete for ${candidateName}.\n\nOverall: ${overallRating} (${overallScore}/10)\n\nView results: ${domain}/tests/${testId}`,
    html: `<p>AI rating is complete for <strong>${candidateName}</strong>.</p>
<p>Overall: <strong>${overallRating}</strong> (${overallScore}/10)</p>
<p><a href="${domain}/tests/${testId}">View Results</a></p>`,
  });
}
