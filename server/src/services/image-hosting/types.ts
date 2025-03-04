export interface ImageUploadOptions {
  base64?: string;
  filePath?: string;
}

export interface ImageUploadResult {
  success: boolean;
  url: string;
  error?: string;
}
