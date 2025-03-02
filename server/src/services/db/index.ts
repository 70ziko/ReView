import { Database } from 'arangojs';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const ARANGO_URL = process.env.ARANGO_URL || 'https://17c43fa12737.arangodb.cloud:8529';
const ARANGO_DB = process.env.ARANGO_DB || '_system';
const ARANGO_USERNAME = process.env.ARANGO_USERNAME || 'root';
const ARANGO_PASSWORD = process.env.ARANGO_DB_ROOT_PASS;

export const GRAPH_NAME = "AmazonReviews";
export const COLLECTIONS = {
    nodes: ["Products", "Reviews", "Users", "Categories"],
    edges: ["HasReview", "WrittenBy", "BelongsToCategory", "VariantOf"]
};

export const db = new Database({
    url: ARANGO_URL,
    auth: {
        username: ARANGO_USERNAME,
        password: ARANGO_PASSWORD!
    },
    databaseName: ARANGO_DB,
});

export const sanitizeKey = (key: string, allowSpaces = false): string => {
    if (!key) return '';
    key = String(key);
    key = key.replace('/', '_').replace('\\', '_').replace('.', '_');

    if (!allowSpaces) {
        key = key.replace(/ /g, '_');
    }
    
    // Replace all but alphanumeric characters, underscores, and hyphens with underscores
    key = key.replace(/[^a-zA-Z0-9_\-]/g, '_');
    
    // Ensure the key is not empty and doesn't start with a number or underscore
    if (!key || key[0].match(/[0-9_]/)) {
        key = 'a' + key;
    }
    
    return key;
};

export const ensureCollectionsExist = async (): Promise<void> => {
    try {
        for (const collection of COLLECTIONS.nodes) {
            const exists = await db.collection(collection).exists();
            
            if (!exists) {
                await db.createCollection(collection);
                console.log(`Created collection: ${collection}`);
                
                if (collection === "Products") {
                    await db.collection(collection).ensureIndex({ 
                        type: "persistent", 
                        fields: ["_key"], 
                        unique: true 
                    });
                    await db.collection(collection).ensureIndex({ 
                        type: "persistent", 
                        fields: ["main_category"], 
                        unique: false 
                    });
                    await db.collection(collection).ensureIndex({ 
                        type: "persistent", 
                        fields: ["parent_asin"], 
                        unique: false 
                    });
                    console.log(`Created indexes for ${collection}`);
                } else if (collection === "Reviews") {
                    await db.collection(collection).ensureIndex({ 
                        type: "persistent", 
                        fields: ["asin"], 
                        unique: false 
                    });
                    await db.collection(collection).ensureIndex({ 
                        type: "persistent", 
                        fields: ["user_id"], 
                        unique: false 
                    });
                    await db.collection(collection).ensureIndex({ 
                        type: "persistent", 
                        fields: ["timestamp"], 
                        unique: false 
                    });
                    await db.collection(collection).ensureIndex({ 
                        type: "persistent", 
                        fields: ["rating"], 
                        unique: false 
                    });
                    console.log(`Created indexes for ${collection}`);
                } else if (collection === "Users") {
                    await db.collection(collection).ensureIndex({ 
                        type: "persistent", 
                        fields: ["_key"], 
                        unique: true 
                    });
                    console.log(`Created indexes for ${collection}`);
                } else if (collection === "Categories") {
                    await db.collection(collection).ensureIndex({ 
                        type: "persistent", 
                        fields: ["_key"], 
                        unique: true 
                    });
                    await db.collection(collection).ensureIndex({ 
                        type: "persistent", 
                        fields: ["level"], 
                        unique: false 
                    });
                    console.log(`Created indexes for ${collection}`);
                }
            } else {
                console.log(`Collection already exists: ${collection}`);
            }
        }
        
        for (const collection of COLLECTIONS.edges) {
            const exists = await db.collection(collection).exists();
            
            if (!exists) {
                await db.createEdgeCollection(collection);
                console.log(`Created edge collection: ${collection}`);
            } else {
                console.log(`Edge collection already exists: ${collection}`);
            }
        }
    } catch (error) {
        console.error('Error ensuring collections exist:', error);
        throw error;
    }
};

export const ensureGraphExists = async (): Promise<void> => {
    try {
        const graphExists = await db.graph(GRAPH_NAME).exists();
        
        if (!graphExists) {
            await db.createGraph(GRAPH_NAME, [
                {
                    collection: "HasReview",
                    from: ["Products"],
                    to: ["Reviews"]
                },
                {
                    collection: "WrittenBy",
                    from: ["Reviews"],
                    to: ["Users"]
                },
                {
                    collection: "BelongsToCategory",
                    from: ["Products"],
                    to: ["Categories"]
                },
                {
                    collection: "VariantOf",
                    from: ["Products"],
                    to: ["Products"]
                }
            ]);
            
            console.log(`Created graph: ${GRAPH_NAME}`);
        } else {
            console.log(`Graph already exists: ${GRAPH_NAME}`);
        }
    } catch (error) {
        console.error('Error ensuring graph exists:', error);
        throw error;
    }
};

export const initializeDatabase = async (): Promise<void> => {
    try {
        await ensureCollectionsExist();
        await ensureGraphExists();
        console.log('Database initialization complete');
    } catch (error) {
        console.error('Database initialization failed:', error);
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
        console.error('AQL query execution error:', error);
        throw error;
    }
};
