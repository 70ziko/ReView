import { ImgurClient } from "imgur";
import { readFile } from "fs/promises";
import { ImageUploadOptions, ImageUploadResult } from "./types";

if (!process.env.IMGUR_CLIENT_ID) {
  throw new Error("IMGUR_CLIENT_ID environment variable is required");
}

const client = new ImgurClient({
  clientId: process.env.IMGUR_CLIENT_ID,
});

async function uploadToImgur(imageData: string | Buffer): Promise<ImageUploadResult> {
  try {
    const response = await client.upload({
      image: imageData,
      type: "base64",
    });

    if (!response.success) {
      return {
        success: false,
        url: "",
        error: "Failed to upload image to Imgur",
      };
    }

    return {
      success: true,
      url: response.data.link,
    };
  } catch (error) {
    return {
      success: false,
      url: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function uploadImage(options: ImageUploadOptions): Promise<ImageUploadResult> {
  try {
    if (!options.base64 && !options.filePath) {
      throw new Error("Either base64 or filePath must be provided");
    }

    let imageData: string | Buffer;

    if (options.base64) {
      // Remove data URL prefix if present
      imageData = options.base64.replace(/^data:image\/\w+;base64,/, "");
    } else if (options.filePath) {
      imageData = await readFile(options.filePath);
    } else {
      throw new Error("Invalid image data");
    }

    return await uploadToImgur(imageData);
  } catch (error) {
    return {
      success: false,
      url: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
