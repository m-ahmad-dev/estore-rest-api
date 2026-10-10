import nodemailer from "nodemailer";
import env from "../../core/configs/env.js";
import passwordResetTemplate from "../../core/templates/reset_password.template.js";
import { getStorefrontUrl } from '../../core/utils/url.utils.js';

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.EMAIL_FROM,
    pass: env.GMAIL_APP_PASSWORD,
  },
});

const EmailService = {
  sendPasswordResetEmail: async ({ to, token }) => {
    const storefrontUrl = getStorefrontUrl();
    if (!storefrontUrl) {
      console.error('[EMAIL CONFIG] STORE_FRONTEND_URL is required in production.');
      return;
    }
    const resetLink = `${storefrontUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

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
