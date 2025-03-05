import { getJson } from "serpapi";
import uploadImage from "../image-hosting";
import { GoogleLensInput } from "./types";
export * from "./types";

export default async function serpGoogleLens(input: GoogleLensInput) {
  try {
    let imageUrl: string;

    if (input.url) {
      imageUrl = input.url;
    } else {
      // Upload image to get a public URL
      const uploadResult = await uploadImage({
        base64: input.base64,
        filePath: input.filePath,
      });

      if (!uploadResult.success) {
        throw new Error(`Failed to upload image: ${uploadResult.error}`);
      }

      imageUrl = uploadResult.url;
    }

    const result = await getJson({
      engine: "google_lens",
      url: imageUrl,
      api_key: process.env.SERPAPI_KEY,
    });

    console.log(result);

    return result;
  } catch (error) {
    throw new Error(
      `Google Lens search failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
