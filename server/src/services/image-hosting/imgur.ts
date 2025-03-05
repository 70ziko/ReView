import { readFile } from "fs/promises";
import { ImageUploadOptions, ImageUploadResult } from "./types";

if (!process.env.IMGUR_CLIENT_ID) {
  throw new Error("IMGUR_CLIENT_ID environment variable is required");
}

const IMGUR_API_URL = 'https://api.imgur.com/3/image';
const CLIENT_ID = process.env.IMGUR_CLIENT_ID;

function cleanBase64String(base64Data: string): string {
  let cleaned = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
  
  while (cleaned.length % 4 !== 0) {
    cleaned += '=';
  }
  
  return cleaned;
}

async function uploadToImgur(imageData: string | Buffer): Promise<ImageUploadResult> {
  try {
    let cleanedData: string;
    
    if (typeof imageData === 'string') {
      cleanedData = cleanBase64String(imageData);
    } else {
      cleanedData = imageData.toString('base64');
    }

    const fetch = await import('node-fetch').then(mod => mod.default);
    const FormData = await import('form-data').then(mod => mod.default);
    const form = new FormData();
    
    form.append('image', cleanedData);
    form.append('type', 'base64');
    form.append('title', 'Uploaded Image');
    
    const response = await fetch(IMGUR_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${CLIENT_ID}`,
        ...form.getHeaders()
      },
      body: form
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      return {
        success: false,
        url: "",
        error: data.data?.error || `Failed to upload image: ${response.status} ${response.statusText}`
      };
    }
    
    return {
      success: true,
      url: data.data.link,
    };
  } catch (error) {
    console.error("Error in uploadToImgur:", error);
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
      imageData = options.base64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
    } else if (options.filePath) {
      imageData = await readFile(options.filePath);
    } else {
      throw new Error("Invalid image data");
    }

    const response = await uploadToImgur(imageData);
    console.log("Image uploaded to Imgur:", response);
    return response;
  } catch (error) {
    console.error("Error uploading image to Imgur:", error);
    return {
      success: false,
      url: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
