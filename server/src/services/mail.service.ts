import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: parseInt(process.env.SMTP_PORT || '587') === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export class MailService {
  public static async sendOtpEmail(to: string, name: string, otp: string): Promise<void> {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0B1220; color: #FFFFFF; padding: 40px; border-radius: 12px; border: 1px solid #1F2937; max-width: 500px; margin: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #2563EB; font-size: 24px; font-weight: 700; margin: 0; letter-spacing: -0.02em;">CIB PORTAL AUTHENTICATION</h2>
          <span style="font-size: 11px; color: #9CA3AF; letter-spacing: 0.1em; text-transform: uppercase;">Classified Intelligence Access</span>
        </div>
        
        <p style="font-size: 14px; color: #E5E7EB; line-height: 1.6; margin-bottom: 20px;">
          Hello, Special Agent <strong>${name}</strong>. A login authorization request was initiated for your CIB console profile. Enter the dynamic security key below to verify your identity:
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <span style="font-family: monospace; font-size: 36px; font-weight: 700; color: #FFFFFF; letter-spacing: 0.15em; background-color: #111827; padding: 14px 28px; border-radius: 8px; border: 1px solid #374151; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);">${otp}</span>
        </div>
        
        <div style="background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; padding: 12px; margin-bottom: 24px;">
          <span style="font-size: 12px; color: #EF4444; font-weight: 600; display: block; margin-bottom: 2px;">⚠️ Dynamic Key Expiry Warning</span>
          <span style="font-size: 11px; color: #9CA3AF; line-height: 1.4; display: block;">This code is valid for exactly 5 minutes. If this request was not initiated by you, lock your credentials immediately.</span>
        </div>
        
        <div style="font-size: 10px; color: #9CA3AF; border-top: 1px solid #1F2937; padding-top: 20px; text-align: center; text-transform: uppercase; letter-spacing: 0.05em;">
          Classified Incident System // Law Enforcement Secure Link Only // AES-GCM-256 Enabled
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"CIB Secure Portal" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Classified Portal Access: One-Time Verification OTP',
      html
    });
  }

  public static async sendWelcomeEmail(to: string, name: string, officerId: string, temporaryPassword: string): Promise<void> {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0B1220; color: #FFFFFF; padding: 40px; border-radius: 12px; border: 1px solid #1F2937; max-width: 500px; margin: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #2563EB; font-size: 24px; font-weight: 700; margin: 0; letter-spacing: -0.02em;">WELCOME TO CIB PORTAL</h2>
          <span style="font-size: 11px; color: #9CA3AF; letter-spacing: 0.1em; text-transform: uppercase;">Classified Intelligence Onboarding</span>
        </div>
        
        <p style="font-size: 14px; color: #E5E7EB; line-height: 1.6; margin-bottom: 20px;">
          Hello, Officer <strong>${name}</strong>. Your secure profile has been created on the Crime Investigation Board portal. Use the credentials below for your initial login:
        </p>
        
        <div style="background-color: #111827; border: 1px solid #374151; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
          <div style="font-size: 13px; color: #9CA3AF; margin-bottom: 8px;"><strong>Officer ID / Username:</strong> <span style="font-family: monospace; color: #FFFFFF; font-size: 14px; font-weight: 600;">${officerId}</span></div>
          <div style="font-size: 13px; color: #9CA3AF;"><strong>Temporary Password:</strong> <span style="font-family: monospace; color: #EF4444; font-size: 14px; font-weight: 600;">${temporaryPassword}</span></div>
        </div>

        <div style="background-color: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.2); border-radius: 6px; padding: 12px; margin-bottom: 24px;">
          <span style="font-size: 12px; color: #3B82F6; font-weight: 600; display: block; margin-bottom: 2px;">🔒 First-Time Login Instructions</span>
          <ol style="font-size: 11px; color: #9CA3AF; padding-left: 16px; margin: 4px 0; line-height: 1.5;">
            <li>Navigate to the CIB portal login page.</li>
            <li>Enter your Officer ID and the Temporary Password.</li>
            <li>You will be prompted to change your temporary password immediately.</li>
            <li>After setting a new password, you can proceed with the standard 2FA OTP login.</li>
          </ol>
        </div>
        
        <div style="font-size: 10px; color: #9CA3AF; border-top: 1px solid #1F2937; padding-top: 20px; text-align: center; text-transform: uppercase; letter-spacing: 0.05em;">
          Classified Incident System // Law Enforcement Secure Link Only // AES-GCM-256 Enabled
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"CIB Secure Portal" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Classified Portal Access: Welcome & Credentials',
      html
    });
  }
}
export { transporter };
