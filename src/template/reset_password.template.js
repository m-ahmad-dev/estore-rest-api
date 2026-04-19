const passwordResetTemplate = ({ resetLink }) => {
  return `
  <div style="font-family: Arial, sans-serif; background:#f6f6f6; padding:20px;">
    <div style="max-width:500px; margin:auto; background:white; padding:20px; border-radius:10px;">
      
      <h2 style="color:#333;">Password Reset Request</h2>
      
      <p>You requested to reset your password.</p>

      <p style="margin:20px 0;">
        <a href="${resetLink}" 
           style="background:#2563eb; color:white; padding:10px 15px; text-decoration:none; border-radius:6px;">
          Reset Password
        </a>
      </p>

      <p style="font-size:12px; color:gray;">
        This link will expire in 5 minutes. If you didn't request this, ignore this email.
      </p>

    </div>
  </div>
  `;
};

export default passwordResetTemplate;
