import { z } from "zod";

export const updateSiteSettingsSchema = z.object({
  contactEmail: z.string().email("Μη έγκυρο email").optional(),
  contactPhone: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  socialLinks: z
    .object({
      facebook: z.string().optional().or(z.literal("")),
      instagram: z.string().optional().or(z.literal("")),
      linkedin: z.string().optional().or(z.literal("")),
    })
    .optional(),
  fallbackVehicleImage: z.string().min(1).optional(),
  featuredVehicleIds: z.array(z.string()).optional(),
});

export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>;
