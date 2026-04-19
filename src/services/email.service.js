import nodemailer from "nodemailer";
import env from "../configs/env.js";
import passwordResetTemplate from "../template/reset_password.template.js";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.EMAIL_FROM,
    pass: env.GMAIL_APP_PASSWORD,
  },
});

const EmailService = {
  sendPasswordResetEmail: async ({ to, token }) => {
    const resetLink = `${env.FRONTEND_URL}/reset-password?token=${token}`;

    try {
      const info = await transporter.sendMail({
        from: `"E-Store" <${env.EMAIL_FROM}>`,
        to,
        subject: "Reset Your Password",
        html: passwordResetTemplate({ resetLink }),
      });

      console.log("Email sent:", info.messageId);
    } catch (error) {
      console.error("Email failed:", error);
    }
  },
};

export default EmailService;
