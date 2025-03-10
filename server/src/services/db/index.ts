import { Database } from "arangojs";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });


const ARANGO_URL = process.env.ARANGO_DB_URL || "http://localhost:8529";
const ARANGO_DB = process.env.ARANGO_DB_DATABASE || "_system";
const ARANGO_USERNAME = process.env.ARANGO_DB_USER || "root";
const ARANGO_PASSWORD = process.env.ARANGO_DB_PASS;


export const GRAPH_NAME = "AmazonReviews";
export const COLLECTIONS = {
  nodes: ["Products", "Reviews", "Users", "Categories"],
  edges: ["HasReview", "WrittenBy", "BelongsToCategory", "VariantOf"],
};

export const db = new Database({
  url: ARANGO_URL,
  auth: {
    username: ARANGO_USERNAME,
    password: ARANGO_PASSWORD!,
  },
  databaseName: ARANGO_DB,
});

export const sanitizeKey = (key: string): string => {
  if (!key) return "";
  key = String(key);

  // Replace all but alphanumeric characters, underscores, and hyphens with underscores
  key = key.replace(/[^a-zA-Z0-9_\-]/g, "_");

  // Ensure the key is not empty and doesn't start with a number or underscore
  if (!key || key[0].match(/[0-9_]/)) {
    key = "a" + key;
  }

  return key;
};

export const ensureCollectionsExist = async (): Promise<void> => {
  try {
    for (const collection of COLLECTIONS.nodes) {
      const exists = await db.collection(collection).exists();
      if (!exists) {
        throw new Error(`Required collection does not exist: ${collection}`);
      }
      console.debug(`Verified collection exists: ${collection}`);
    }

    for (const collection of COLLECTIONS.edges) {
      const exists = await db.collection(collection).exists();
      if (!exists) {
        throw new Error(`Required edge collection does not exist: ${collection}`);
      }
      console.debug(`Verified edge collection exists: ${collection}`);
    }
  } catch (error) {
    console.error("Error verifying collections:", error);
    throw error;
  }
};

export const ensureGraphExists = async (): Promise<void> => {
  try {
    const graphExists = await db.graph(GRAPH_NAME).exists();
    if (!graphExists) {
      throw new Error(`Required graph does not exist: ${GRAPH_NAME}`);
    }
    console.log(`Verified graph exists: ${GRAPH_NAME}`);
  } catch (error) {
    console.error("Error verifying graph exists:", error);
    throw error;
  }
};

export const initializeDatabase = async (): Promise<void> => {
  try {
    await ensureCollectionsExist();
    await ensureGraphExists();
    console.log("Database verification complete");
  } catch (error) {
    console.error("Database verification failed:", error);
    throw error;
  }
};

export const executeAqlQuery = async <T = any>(
  queryString: string,
  bindVars: Record<string, any> = {}
): Promise<T[]> => {
  try {
    const cursor = await db.query(queryString, bindVars);
    return await cursor.all();
  } catch (error) {
    console.error("AQL query execution error:", error);
    throw error;
  }
};
