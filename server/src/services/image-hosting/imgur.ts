import { readFile } from "fs/promises";
import { ImageUploadOptions, ImageUploadResult } from "./types";

if (!process.env.IMGUR_CLIENT_ID) {
  throw new Error("IMGUR_CLIENT_ID environment variable is required");
}

const IMGUR_API_URL = 'https://api.imgur.com/3/image';
const CLIENT_ID = process.env.IMGUR_CLIENT_ID;

async function uploadToImgur(imageData: string | Buffer): Promise<ImageUploadResult> {
  try {
    const formData = new FormData();
    
    if (typeof imageData === 'string') {
      // Handle base64 string
      formData.append('image', imageData);
      formData.append('type', 'base64');
    } else {
      // Handle buffer
      const blob = new Blob([imageData]);
      formData.append('image', blob);
      formData.append('type', 'file');
    }
    
    formData.append('title', 'Uploaded Image');
    // formData.append('description', 'Uploaded temprory Image to get public URL');
    
    const response = await fetch(IMGUR_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${CLIENT_ID}`
      },
      body: formData
    });
    
    const data = await response.json();
    console.log("Imgur upload response:", data);
    
    if (!response.ok || !data.success) {
      return {
        success: false,
        url: "",
        error: data.data?.error || "Failed to upload image to Imgur",
      };
    }
    
    return {
      success: true,
      url: data.data.link,
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
    } else 
    if (options.filePath) {
      imageData = await readFile(options.filePath);
    } else {
      throw new Error("Invalid image data");
    }

    const response = await uploadToImgur(imageData);
    console.log("Image uploaded to Imgur:", response);
    return response;
  } catch (error) {
    console.log("Error uploading image to Imgur:", error);
    return {
      success: false,
      url: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
