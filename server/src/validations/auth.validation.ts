import { z } from 'zod';

export const RequestOtpSchema = z.object({
  body: z.object({
    officerId: z.string().min(1, 'Officer ID must be specified.'),
    password: z.string().min(1, 'Password field required.')
  })
});

export const VerifyOtpSchema = z.object({
  body: z.object({
    officerId: z.string().min(1, 'Officer ID required.'),
    code: z.string().length(6, 'Verification code must be exactly 6 digits.')
  })
});

export const ResendOtpSchema = z.object({
  body: z.object({
    officerId: z.string().min(1, 'Officer ID required.')
  })
});

export const ChangePasswordSchema = z.object({
  body: z.object({
    officerId: z.string().min(1, 'Officer ID must be specified.'),
    oldPassword: z.string().optional(),
    newPassword: z.string().min(6, 'New password must be at least 6 characters.')
  })
});
