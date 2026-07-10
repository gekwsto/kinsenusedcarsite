import { z } from "zod";

export const carStockItemSchema = z.object({
  CarId: z.union([z.string(), z.number()]),
  Maker: z.string().optional(),
  Model: z.string().optional(),
  YearRelease: z.union([z.string(), z.number()]).optional(),
  Price: z.union([z.string(), z.number()]).optional(),
  MonthlyPrice: z.union([z.string(), z.number()]).optional(),
  Km: z.union([z.string(), z.number()]).optional(),
  Cc: z.union([z.string(), z.number()]).optional(),
  Hp: z.union([z.string(), z.number()]).optional(),
  Fuel: z.string().optional(),
  TransmissionType: z.string().optional(),
  Color: z.string().optional(),
  Offer: z.union([z.boolean(), z.string(), z.number()]).optional(),
  Froze: z.union([z.boolean(), z.string(), z.number()]).optional(),
  Delete: z.union([z.boolean(), z.string(), z.number()]).optional(),
  TypeOfCar: z.string().optional(),
  Plate: z.string().optional(),
  VIN: z.string().optional(),
});

export const carStockPayloadSchema = z.array(carStockItemSchema).min(1);

export type CarStockPayloadItem = z.infer<typeof carStockItemSchema>;
