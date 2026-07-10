import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export { FALLBACK_VEHICLE_IMAGE } from "@/lib/utils";

interface UploadResult {
  url: string;
}

interface ImageDriver {
  upload(file: File, folder: string): Promise<UploadResult>;
  remove(url: string): Promise<void>;
}

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);

class LocalImageDriver implements ImageDriver {
  private readonly uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR ?? "./public/uploads";
  }

  async upload(file: File, folder: string): Promise<UploadResult> {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`Unsupported image type: .${ext}`);
    }

    const filename = `${randomUUID()}.${ext}`;
    const targetDir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(targetDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(targetDir, filename), buffer);

    return { url: `/uploads/${folder}/${filename}` };
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith("/uploads/")) return;
    const filePath = path.join(process.cwd(), "public", url);
    await unlink(filePath).catch(() => undefined);
  }
}

function getDriver(): ImageDriver {
  const driver = process.env.UPLOAD_DRIVER ?? "local";
  switch (driver) {
    case "local":
      return new LocalImageDriver();
    default:
      throw new Error(
        `Upload driver "${driver}" is not implemented yet. Only "local" is available in v1 — implement ImageDriver for s3/cloudinary and wire it up here.`,
      );
  }
}

export async function uploadVehicleImage(file: File, vehicleId: string): Promise<UploadResult> {
  return getDriver().upload(file, `vehicles/${vehicleId}`);
}

export async function removeUploadedImage(url: string): Promise<void> {
  return getDriver().remove(url);
}
