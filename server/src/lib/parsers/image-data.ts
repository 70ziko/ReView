import { GoogleLensInput } from "../../services/serp-google-lens";

/**
 * Converts a string input to GoogleLensInput by determining its type
 * @param input - URL, base64 string, or file path
 * @returns GoogleLensInput object with the appropriate property set
 */
export function parseGoogleLensInput(input: string): GoogleLensInput {
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return { url: input };
  }
  
  if (input.startsWith('data:image/') || 
      (input.match(/^[A-Za-z0-9+/=]+$/) && input.length % 4 === 0)) {
    return { base64: input };
  }
  
  return { filePath: input };
}