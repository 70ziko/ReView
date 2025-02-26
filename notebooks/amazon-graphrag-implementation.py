# Amazon Reviews GraphRAG Implementation
# =====================================
#
# This notebook implements a GraphRAG system for Amazon product reviews using ArangoDB
# for graph storage and querying, and LangChain/LangGraph for the agentic components.

# Step 0: Package Installation & Setup
# -----------------------------------

!pip install nx-arangodb langchain langchain-community langchain-openai langgraph
!pip install pandas numpy matplotlib tqdm openai

import os
import json
import pandas as pd
import numpy as np
import re
import networkx as nx
import nx_arangodb as nxadb
from tqdm import tqdm
import matplotlib.pyplot as plt
from arango import ArangoClient

# For the agentic components
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.graphs import ArangoGraph
from langchain_community.chains.graph_qa.arangodb import ArangoGraphQAChain
from langchain_core.tools import tool
from langchain_community.vectorstores.chroma import Chroma

# Connect to the ArangoDB database
# Replace with your own credentials
client = ArangoClient(hosts="http://localhost:8529")
db = client.db("_system", username="root", password="yourpassword", verify=True)

print(f"Connected to ArangoDB: {client.version()}")

# Step 1: Load and Transform the Amazon Review Data
# ------------------------------------------------

import os
import gzip
import urllib.request
import time
from tqdm import tqdm

def download_file(url, target_path):
    """Download a file from URL to target path with progress bar"""
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    
    if os.path.exists(target_path):
        print(f"File already exists: {target_path}")
        return target_path
    
    print(f"Downloading {url} to {target_path}")
    
    try:
        # Set up progress bar
        response = urllib.request.urlopen(url)
        file_size = int(response.headers.get('Content-Length', 0))
        
        # Create progress bar
        progress = tqdm(total=file_size, unit='B', unit_scale=True, desc=os.path.basename(target_path))
        
        # Download with progress updates
        with open(target_path, 'wb') as f:
            block_size = 8192
            while True:
                buffer = response.read(block_size)
                if not buffer:
                    break
                f.write(buffer)
                progress.update(len(buffer))
                
        progress.close()
        print(f"Downloaded {target_path}")
        return target_path
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return None

def extract_gzip(gzip_path, extract_path=None):
    """Extract a gzip file to the specified path"""
    if extract_path is None:
        # Remove .gz extension if present
        extract_path = gzip_path[:-3] if gzip_path.endswith('.gz') else gzip_path + '_extracted'
    
    if os.path.exists(extract_path):
        print(f"Extracted file already exists: {extract_path}")
        return extract_path
    
    print(f"Extracting {gzip_path} to {extract_path}")
    try:
        with gzip.open(gzip_path, 'rb') as f_in:
            with open(extract_path, 'wb') as f_out:
                f_out.write(f_in.read())
        print(f"Extracted to {extract_path}")
        return extract_path
    except Exception as e:
        print(f"Error extracting {gzip_path}: {e}")
        return None

def load_json_data(file_path, limit=None):
    """Load JSON data from file, line by line"""
    data = []
    with open(file_path, 'r') as file:
        for i, line in enumerate(file):
            if limit is not None and i >= limit:
                break
            try:
                data.append(json.loads(line.strip()))
            except json.JSONDecodeError:
                print(f"Error decoding JSON on line {i+1}")
    return data

def parse_download_links(file_path):
    """Parse download links from file"""
    links = {}
    with open(file_path, 'r') as file:
        for line in file:
            parts = line.strip().split(': ')
            if len(parts) == 2:
                category, url = parts
                links[category] = url
    return links

# Create data directories
DATA_DIR = "amazon_data"
DOWNLOAD_DIR = os.path.join(DATA_DIR, "downloaded")
EXTRACTED_DIR = os.path.join(DATA_DIR, "extracted")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)
os.makedirs(EXTRACTED_DIR, exist_ok=True)

# Parse download links
download_links = parse_download_links("paste.txt")
print(f"Found {len(download_links)} category download links")

# Metadata URL pattern
# Assuming metadata URLs follow the same pattern with 'meta_' prefix
META_URL_BASE = "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/raw/meta_categories/meta_"

# Function to process a single category
def process_category(category, review_url, sample_size=1000, meta_sample_size=500):
    """Download, extract, and load data for a single category"""
    print(f"\n{'='*50}")
    print(f"Processing category: {category}")
    print(f"{'='*50}")
    
    # Determine file paths
    review_gz_path = os.path.join(DOWNLOAD_DIR, f"{category}.jsonl.gz")
    review_path = os.path.join(EXTRACTED_DIR, f"{category}.jsonl")
    
    # For metadata, construct the URL and paths
    meta_url = META_URL_BASE + category + ".jsonl.gz"
    meta_gz_path = os.path.join(DOWNLOAD_DIR, f"meta_{category}.jsonl.gz")
    meta_path = os.path.join(EXTRACTED_DIR, f"meta_{category}.jsonl")
    
    # Download and extract review data
    download_file(review_url, review_gz_path)
    extract_gzip(review_gz_path, review_path)
    
    # Download and extract metadata
    try:
        download_file(meta_url, meta_gz_path)
        extract_gzip(meta_gz_path, meta_path)
    except Exception as e:
        print(f"Error downloading metadata for {category}: {e}")
        print("Continuing without metadata for this category")
        meta_path = None
    
    # Load review data (with limit for testing)
    print(f"Loading review data for {category}...")
    reviews_data = load_json_data(review_path, limit=sample_size)
    print(f"Loaded {len(reviews_data)} reviews")
    
    # Load metadata if available
    metadata_data = []
    if meta_path and os.path.exists(meta_path):
        print(f"Loading product metadata for {category}...")
        metadata_data = load_json_data(meta_path, limit=meta_sample_size)
        print(f"Loaded {len(metadata_data)} product metadata entries")
    
    return reviews_data, metadata_data

# Process categories
# For testing, we'll just process one category first
# You can modify this to process all categories or a subset
CATEGORIES_TO_PROCESS = list(download_links.keys())[:1]  # Start with just one for testing
print(f"Will process {len(CATEGORIES_TO_PROCESS)} categories: {CATEGORIES_TO_PROCESS}")

# For demonstration, process just the first category
CATEGORY = CATEGORIES_TO_PROCESS[0]
reviews_data, metadata_data = process_category(CATEGORY, download_links[CATEGORY])

# You can expand this to process all categories sequentially or in parallel
# Example for processing all categories:
"""
all_reviews = {}
all_metadata = {}
for category, url in download_links.items():
    reviews, metadata = process_category(category, url)
    all_reviews[category] = reviews
    all_metadata[category] = metadata
"""

# Step 2: Create and Configure the ArangoDB Graph
# -----------------------------------------------

# Define the collections needed for our graph
GRAPH_NAME = "AmazonReviews"
COLLECTIONS = {
    "nodes": ["Products", "Reviews", "Users", "Categories"],
    "edges": ["HasReview", "WrittenBy", "BelongsToCategory", "VariantOf"]
}

# Create collections if they don't exist
def ensure_collections_exist():
    """Create the required collections if they don't exist"""
    # Create node collections
    for collection in COLLECTIONS["nodes"]:
        if not db.has_collection(collection):
            db.create_collection(collection)
            print(f"Created collection: {collection}")
            
            # Create indexes for faster queries
            if collection == "Products":
                # Index on ASIN (product ID)
                db.collection(collection).add_hash_index(["_key"], unique=True)
                # Index on main category for category-based queries
                db.collection(collection).add_hash_index(["main_category"], unique=False)
                # Index on product parent ASIN for variant relationships
                db.collection(collection).add_hash_index(["parent_asin"], unique=False)
                print(f"Created indexes for {collection}")
                
            elif collection == "Reviews":
                # Index on product ASIN for finding reviews of a product
                db.collection(collection).add_hash_index(["asin"], unique=False)
                # Index on user ID for finding reviews by a user
                db.collection(collection).add_hash_index(["user_id"], unique=False)
                # Index on timestamp for chronological queries
                db.collection(collection).add_skiplist_index(["timestamp"], unique=False)
                # Index on rating for filtering by rating
                db.collection(collection).add_skiplist_index(["rating"], unique=False)
                print(f"Created indexes for {collection}")
                
            elif collection == "Users":
                # Index on user ID
                db.collection(collection).add_hash_index(["_key"], unique=True)
                print(f"Created indexes for {collection}")
                
            elif collection == "Categories":
                # Index on category name
                db.collection(collection).add_hash_index(["_key"], unique=True)
                # Index on category level for hierarchical queries
                db.collection(collection).add_skiplist_index(["level"], unique=False)
                print(f"Created indexes for {collection}")
        else:
            print(f"Collection already exists: {collection}")
    
    # Create edge collections
    for collection in COLLECTIONS["edges"]:
        if not db.has_collection(collection):
            db.create_collection(collection, edge=True)
            print(f"Created edge collection: {collection}")
        else:
            print(f"Edge collection already exists: {collection}")

# Create the graph if it doesn't exist
def ensure_graph_exists():
    """Create the graph if it doesn't exist"""
    if not db.has_graph(GRAPH_NAME):
        graph = db.create_graph(GRAPH_NAME)
        
        # Define edge definitions
        graph.create_edge_definition(
            edge_collection="HasReview",
            from_vertex_collections=["Products"],
            to_vertex_collections=["Reviews"]
        )
        
        graph.create_edge_definition(
            edge_collection="WrittenBy",
            from_vertex_collections=["Reviews"],
            to_vertex_collections=["Users"]
        )
        
        graph.create_edge_definition(
            edge_collection="BelongsToCategory",
            from_vertex_collections=["Products"],
            to_vertex_collections=["Categories"]
        )
        
        graph.create_edge_definition(
            edge_collection="VariantOf",
            from_vertex_collections=["Products"],
            to_vertex_collections=["Products"]
        )
        
        print(f"Created graph: {GRAPH_NAME}")
    else:
        print(f"Graph already exists: {GRAPH_NAME}")

# Create collections and graph
ensure_collections_exist()
ensure_graph_exists()

# Step 3: Transform and Insert the Data
# ------------------------------------

# Prepare products data
def prepare_products_data(metadata_list):
    """Transform metadata into a format suitable for Products collection"""
    products = []
    for item in metadata_list:
        # Combine description into a single string if it's a list
        description = ' '.join(item.get('description', [])) if isinstance(item.get('description', []), list) else item.get('description', '')
        
        # Extract features as a list
        features = item.get('features', [])
        features_text = ' '.join(features) if features else ''
        
        # Prepare product document
        product = {
            "_key": item.get('asin', ''),
            "title": item.get('title', ''),
            "main_category": item.get('main_category', ''),
            "description": description,
            "features": features,
            "features_text": features_text,
            "price": item.get('price', 0),
            "average_rating": item.get('average_rating', 0),
            "rating_count": item.get('rating_number', 0),
            "store": item.get('store', ''),
            "details": item.get('details', {}),
            "parent_asin": item.get('parent_asin', ''),
            "bought_together": item.get('bought_together', []),
            "images": [img.get('large', '') for img in item.get('images', []) if 'large' in img][:3]  # Store up to 3 image URLs
        }
        products.append(product)
    return products

# Prepare reviews data
def prepare_reviews_data(reviews_list):
    """Transform reviews into a format suitable for Reviews collection"""
    reviews = []
    for item in reviews_list:
        # Create a unique key for the review using asin + user_id + timestamp
        timestamp = item.get('sort_timestamp', '')
        key = f"{item.get('asin', '')}-{item.get('user_id', '')}-{timestamp}"
        
        # Extract image URLs if available
        images = []
        for img in item.get('images', []):
            if 'large_image_url' in img:
                images.append(img['large_image_url'])
        
        # Prepare review document
        review = {
            "_key": key,
            "asin": item.get('asin', ''),
            "user_id": item.get('user_id', ''),
            "parent_asin": item.get('parent_asin', ''),
            "rating": item.get('rating', 0),
            "title": item.get('title', ''),
            "text": item.get('text', ''),
            "timestamp": timestamp,
            "helpful_votes": item.get('helpful_votes', 0),
            "verified_purchase": item.get('verified_purchase', False),
            "images": images
        }
        reviews.append(review)
    return reviews

# Extract users from reviews
def extract_users(reviews_list):
    """Extract unique users from reviews data"""
    users = {}
    for review in reviews_list:
        user_id = review.get('user_id', '')
        if user_id and user_id not in users:
            users[user_id] = {
                "_key": user_id,
                "review_count": 1
            }
        elif user_id:
            users[user_id]["review_count"] += 1
    return list(users.values())

# Extract categories from products
def extract_categories(products_list):
    """Extract unique categories from product metadata"""
    categories = {}
    for product in products_list:
        main_category = product.get('main_category', '')
        if main_category and main_category not in categories:
            categories[main_category] = {
                "_key": main_category.replace(' ', '_'),
                "name": main_category,
                "level": 0  # Top level category
            }
        
        # Process hierarchical categories if available
        if 'categories' in product and isinstance(product['categories'], list):
            for i, category_list in enumerate(product['categories']):
                if isinstance(category_list, list):
                    for j, category in enumerate(category_list):
                        if category and category not in categories:
                            categories[category] = {
                                "_key": category.replace(' ', '_'),
                                "name": category,
                                "level": j+1  # Level in hierarchy
                            }
    return list(categories.values())

# Create edge data
def create_has_review_edges(reviews):
    """Create edges connecting products to reviews"""
    edges = []
    for review in reviews:
        edge = {
            "_from": f"Products/{review['asin']}",
            "_to": f"Reviews/{review['_key']}"
        }
        edges.append(edge)
    return edges

def create_written_by_edges(reviews):
    """Create edges connecting reviews to users"""
    edges = []
    for review in reviews:
        edge = {
            "_from": f"Reviews/{review['_key']}",
            "_to": f"Users/{review['user_id']}"
        }
        edges.append(edge)
    return edges

def create_belongs_to_category_edges(products):
    """Create edges connecting products to categories"""
    edges = []
    for product in products:
        if product.get('main_category'):
            edge = {
                "_from": f"Products/{product['_key']}",
                "_to": f"Categories/{product['main_category'].replace(' ', '_')}"
            }
            edges.append(edge)
    return edges

def create_variant_of_edges(products):
    """Create edges connecting product variants"""
    edges = []
    for product in products:
        if product.get('parent_asin') and product.get('parent_asin') != product.get('_key'):
            edge = {
                "_from": f"Products/{product['_key']}",
                "_to": f"Products/{product['parent_asin']}"
            }
            edges.append(edge)
    return edges

# Transform the data
products = prepare_products_data(metadata_data)
reviews = prepare_reviews_data(reviews_data)
users = extract_users(reviews)
categories = extract_categories(products)

# Create edge data
has_review_edges = create_has_review_edges(reviews)
written_by_edges = create_written_by_edges(reviews)
belongs_to_category_edges = create_belongs_to_category_edges(products)
variant_of_edges = create_variant_of_edges(products)

# Insert data into ArangoDB collections
def insert_documents(collection_name, documents, batch_size=100):
    """Insert documents into a collection with batch processing"""
    collection = db.collection(collection_name)
    
    # Process in batches to avoid memory issues with large datasets
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i+batch_size]
        try:
            collection.import_bulk(batch, on_duplicate="update")
        except Exception as e:
            print(f"Error inserting batch into {collection_name}: {e}")
    
    print(f"Inserted {len(documents)} documents into {collection_name}")

# Insert node data
print("Inserting product data...")
insert_documents("Products", products)

print("Inserting review data...")
insert_documents("Reviews", reviews)

print("Inserting user data...")
insert_documents("Users", users)

print("Inserting category data...")
insert_documents("Categories", categories)

# Insert edge data
print("Creating product-review connections...")
insert_documents("HasReview", has_review_edges)

print("Creating review-user connections...")
insert_documents("WrittenBy", written_by_edges)

print("Creating product-category connections...")
insert_documents("BelongsToCategory", belongs_to_category_edges)

print("Creating product variant connections...")
insert_documents("VariantOf", variant_of_edges)

# Step 4: Create the NetworkX Integration (for Graph Analytics)
# ------------------------------------------------------------

# Create the NetworkX graph from ArangoDB
G_adb = nxadb.Graph(name=GRAPH_NAME, db=db)

print(G_adb)

# Step 5: Generate and Store Embeddings
# ------------------------------------

# Define your OpenAI API key
os.environ["OPENAI_API_KEY"] = "sk-your-openai-api-key"

# Initialize the embeddings model
embeddings_model = OpenAIEmbeddings()

# Create embeddings for products
def generate_product_embeddings():
    """Generate embeddings for product data and store in ArangoDB"""
    products_collection = db.collection("Products")
    batch_size = 25  # Process in small batches to avoid rate limits
    
    for i in range(0, products_collection.count(), batch_size):
        # Get a batch of products
        products_batch = list(products_collection.all().limit(batch_size).offset(i))
        
        # Prepare text for embedding
        product_texts = []
        for product in products_batch:
            # Combine title, features, and description for a rich representation
            text = f"{product.get('title', '')} {product.get('features_text', '')} {product.get('description', '')}"
            product_texts.append(text)
        
        # Generate embeddings in batches
        print(f"Generating embeddings for products {i} to {i+len(product_texts)}")
        try:
            embeddings = embeddings_model.embed_documents(product_texts)
            
            # Update products with embeddings
            for j, product in enumerate(products_batch):
                products_collection.update({
                    "_key": product["_key"],
                    "embedding": embeddings[j]
                })
        except Exception as e:
            print(f"Error generating embeddings: {e}")

# Create embeddings for reviews
def generate_review_embeddings():
    """Generate embeddings for review data and store in ArangoDB"""
    reviews_collection = db.collection("Reviews")
    batch_size = 25  # Process in small batches to avoid rate limits
    
    for i in range(0, reviews_collection.count(), batch_size):
        # Get a batch of reviews
        reviews_batch = list(reviews_collection.all().limit(batch_size).offset(i))
        
        # Prepare text for embedding
        review_texts = []
        for review in reviews_batch:
            # Combine title and text for a rich representation
            text = f"{review.get('title', '')} {review.get('text', '')}"
            review_texts.append(text)
        
        # Generate embeddings in batches
        print(f"Generating embeddings for reviews {i} to {i+len(review_texts)}")
        try:
            embeddings = embeddings_model.embed_documents(review_texts)
            
            # Update reviews with embeddings
            for j, review in enumerate(reviews_batch):
                reviews_collection.update({
                    "_key": review["_key"],
                    "embedding": embeddings[j]
                })
        except Exception as e:
            print(f"Error generating embeddings: {e}")

# Generate embeddings (uncomment to execute - can take time for large datasets)
# generate_product_embeddings()
# generate_review_embeddings()
print("Embeddings generation code is ready but commented out to avoid API costs. Uncomment as needed.")

# Step 6: Build the Agentic App with LangChain & LangGraph
# -------------------------------------------------------

# Initialize the LLM
llm = ChatOpenAI(temperature=0.1, model_name="gpt-4o")

# Create the ArangoGraph LangChain wrapper
arango_graph = ArangoGraph(db)

# Define tools for the agent

@tool
def get_product_by_description(query: str):
    """
    This tool finds products that match a given description.
    It searches through product titles, features, and descriptions to find the best matches.
    """
    # Convert query to embedding
    query_embedding = embeddings_model.embed_query(query)
    
    # Prepare AQL query with vector search
    aql = """
    FOR product IN Products
        LET score = COSINE_SIMILARITY(product.embedding, @embedding)
        FILTER score > 0.7
        SORT score DESC
        LIMIT 5
        RETURN {
            asin: product._key,
            title: product.title,
            description: product.description,
            price: product.price,
            average_rating: product.average_rating,
            score: score
        }
    """
    
    # Execute query
    cursor = db.aql.execute(aql, bind_vars={"embedding": query_embedding})
    results = list(cursor)
    
    if not results:
        return "No products found matching your description."
    
    # Format results
    response = "Here are products that match your description:\n\n"
    for i, product in enumerate(results, 1):
        response += f"{i}. {product['title']}\n"
        response += f"   Price: ${product['price']}\n"
        response += f"   Rating: {product['average_rating']}/5.0\n"
        response += f"   ASIN: {product['asin']}\n\n"
    
    return response

@tool
def get_reviews_for_product(asin: str):
    """
    This tool retrieves reviews for a specific product identified by its ASIN.
    It returns the most helpful reviews first.
    """
    # Prepare AQL query
    aql = """
    FOR review IN Reviews
        FILTER review.asin == @asin
        SORT review.helpful_votes DESC
        LIMIT 5
        RETURN {
            title: review.title,
            text: review.text,
            rating: review.rating,
            helpful_votes: review.helpful_votes,
            verified_purchase: review.verified_purchase
        }
    """
    
    # Execute query
    cursor = db.aql.execute(aql, bind_vars={"asin": asin})
    reviews = list(cursor)
    
    if not reviews:
        return f"No reviews found for product with ASIN {asin}."
    
    # Get product title
    product_query = """
    FOR product IN Products
        FILTER product._key == @asin
        RETURN product.title
    """
    product_cursor = db.aql.execute(product_query, bind_vars={"asin": asin})
    product_title = list(product_cursor)[0] if list(product_cursor) else "Unknown Product"
    
    # Format results
    response = f"Reviews for {product_title} (ASIN: {asin}):\n\n"
    for i, review in enumerate(reviews, 1):
        response += f"{i}. {review['title']} - {review['rating']}/5.0 stars\n"
        response += f"   {review['text']}\n"
        if review['verified_purchase']:
            response += f"   (Verified Purchase)\n"
        response += f"   Helpful votes: {review['helpful_votes']}\n\n"
    
    return response

@tool
def text_to_aql_to_text(query: str):
    """
    This tool translates a natural language query into AQL, executes it,
    and returns the results in natural language.
    Use this for complex searches and relationships in the product graph.
    """
    chain = ArangoGraphQAChain.from_llm(
        llm=llm,
        graph=arango_graph,
        verbose=True
    )
    
    result = chain.invoke(query)
    return str(result["result"])

@tool
def analyze_product_network(query: str):
    """
    This tool uses graph analytics to analyze the product network.
    It can identify related products, popular items, and customer patterns.
    """
    # Parse the query to determine what kind of analysis to perform
    if "popular" in query.lower() or "best selling" in query.lower():
        # Find most reviewed products
        aql = """
        FOR product IN Products
            SORT product.rating_count DESC
            LIMIT 5
            RETURN {
                asin: product._key,
                title: product.title,
                reviews: product.rating_count,
                rating: product.average_rating
            }
        """
        cursor = db.aql.execute(aql)
        products = list(cursor)
        
        response = "Most popular products based on number of reviews:\n\n"
        for i, product in enumerate(products, 1):
            response += f"{i}. {product['title']}\n"
            response += f"   Total reviews: {product['reviews']}\n"
            response += f"   Average rating: {product['rating']}/5.0\n\n"
        
        return response
    
    elif "similar" in query.lower() or "related" in query.lower():
        # Extract ASIN from query if present
        asin_match = re.search(r'[A-Z0-9]{10}', query)
        if asin_match:
            asin = asin_match.group(0)
            
            # Find related products (variants or commonly bought together)
            aql = """
            LET variants = (
                FOR v, e IN 1..1 ANY @asin VariantOf
                    RETURN v
            )
            
            LET product = DOCUMENT(CONCAT('Products/', @asin))
            
            LET similar_products = (
                FOR other IN Products
                    FILTER other._key != @asin
                    FILTER other.main_category == product.main_category
                    SORT ABS(other.price - product.price) ASC
                    LIMIT 3
                    RETURN other
            )
            
            RETURN {
                variants: variants,
                similar: similar_products,
                original: product
            }
            """
            
            cursor = db.aql.execute(aql, bind_vars={"asin": asin})
            result = next(cursor, None)
            
            if not result or not result.get('original'):
                return f"Could not find product with ASIN {asin}."
            
            response = f"Analysis for product: {result['original'].get('title', 'Unknown')}\n\n"
            
            if result['variants']:
                response += "Product variants:\n"
                for i, variant in enumerate(result['variants'], 1):
                    response += f"{i}. {variant.get('title', 'Unknown')}\n"
                    response += f"   Price: ${variant.get('price', 0)}\n"
                    response += f"   ASIN: {variant.get('_key', 'Unknown')}\n\n"
            
            if result['similar']:
                response += "Similar products by price and category:\n"
                for i, similar in enumerate(result['similar'], 1):
                    response += f"{i}. {similar.get('title', 'Unknown')}\n"
                    response += f"   Price: ${similar.get('price', 0)}\n"
                    response += f"   ASIN: {similar.get('_key', 'Unknown')}\n\n"
            
            return response
        else:
            return "To find similar products, please provide a valid ASIN (10-character Amazon product ID)."
    
    else:
        # Default to general graph statistics
        product_count = db.collection("Products").count()
        review_count = db.collection("Reviews").count()
        user_count = db.collection("Users").count()
        
        return f"""
        Graph Analytics Summary:
        
        - Total Products: {product_count}
        - Total Reviews: {review_count}
        - Total Users: {user_count}
        
        To get more specific analytics, try asking about:
        - Popular or best-selling products
        - Similar or related products (with an ASIN)
        - Category trends
        """

# Create the Agent
def create_graph_rag_agent():
    """Create and return the GraphRAG agent"""
    tools = [
        get_product_by_description,
        get_reviews_for_product,
        text_to_aql_to_text,
        analyze_product_network
    ]
    
    return create_react_agent(llm, tools)

# Function to query the agent
def query_graph_rag(query):
    """Query the GraphRAG agent with a user question"""
    agent = create_graph_rag_agent()
    final_state = agent.invoke({"messages": [{"role": "user", "content": query}]})
    return final_state["messages"][-1].content

# Step 7: Testing the GraphRAG System
# ----------------------------------

# Test queries
test_queries = [
    "Find products similar to moisturizer",
    "What are the reviews for product B088SZDGXG?",
    "What's the most popular beauty product?",
    "Tell me about products with the highest ratings",
    "Find products under $10 with good reviews"
]

# Uncomment to test the agent
# for query in test_queries:
#     print(f"\nQuery: {query}")
#     print("-" * 50)
#     response = query_graph_rag(query)
#     print(response)
#     print("=" * 80)

print("GraphRAG implementation complete! Run the test queries to see it in action.")

# Step 8: Process Multiple Categories
# -----------------------------

def process_all_categories(download_links, limit=None, batch_size=1000):
    """Process multiple categories with rate limiting and batch processing"""
    categories_processed = 0
    
    # Create a processing queue from the download links
    categories_to_process = list(download_links.keys())
    if limit:
        categories_to_process = categories_to_process[:limit]
    
    print(f"Will process {len(categories_to_process)} categories")
    
    for category in categories_to_process:
        print(f"\n{'='*50}")
        print(f"Processing category {categories_processed + 1}/{len(categories_to_process)}: {category}")
        print(f"{'='*50}")
        
        # Get the download URL for this category
        review_url = download_links[category]
        
        # Process the category data
        reviews_data, metadata_data = process_category(category, review_url)
        
        # Skip if no data was loaded
        if not reviews_data:
            print(f"No review data available for {category}, skipping...")
            continue
        
        # Transform the data
        print(f"Transforming data for {category}...")
        category_products = prepare_products_data(metadata_data)
        category_reviews = prepare_reviews_data(reviews_data)
        category_users = extract_users(category_reviews)
        category_categories = extract_categories(category_products)
        
        # Create edge data
        category_has_review_edges = create_has_review_edges(category_reviews)
        category_written_by_edges = create_written_by_edges(category_reviews)
        category_belongs_to_category_edges = create_belongs_to_category_edges(category_products)
        category_variant_of_edges = create_variant_of_edges(category_products)
        
        # Insert data in batches
        print(f"Inserting data for {category} into ArangoDB...")
        
        # Insert node data
        print("Inserting product data...")
        insert_documents("Products", category_products, batch_size)
        
        print("Inserting review data...")
        insert_documents("Reviews", category_reviews, batch_size)
        
        print("Inserting user data...")
        insert_documents("Users", category_users, batch_size)
        
        print("Inserting category data...")
        insert_documents("Categories", category_categories, batch_size)
        
        # Insert edge data
        print("Creating product-review connections...")
        insert_documents("HasReview", category_has_review_edges, batch_size)
        
        print("Creating review-user connections...")
        insert_documents("WrittenBy", category_written_by_edges, batch_size)
        
        print("Creating product-category connections...")
        insert_documents("BelongsToCategory", category_belongs_to_category_edges, batch_size)
        
        print("Creating product variant connections...")
        insert_documents("VariantOf", category_variant_of_edges, batch_size)
        
        # Generate embeddings for this category
        if os.environ.get("OPENAI_API_KEY"):
            print(f"Generating embeddings for {category} products and reviews...")
            generate_category_embeddings(category, batch_size=25)
        
        # Increment the counter
        categories_processed += 1
        
        # Add a delay between categories to avoid overwhelming the database
        if categories_processed < len(categories_to_process):
            delay = 5  # seconds
            print(f"Waiting {delay} seconds before processing the next category...")
            time.sleep(delay)
    
    print(f"\nProcessed {categories_processed}/{len(categories_to_process)} categories successfully")

def generate_category_embeddings(category, batch_size=25):
    """Generate embeddings for products and reviews of a specific category"""
    # Query products in this category
    aql_products = """
    FOR p IN Products
        FILTER p.main_category == @category AND NOT HAS(p, "embedding")
        LIMIT @batch_size
        RETURN p
    """
    
    # Process products in batches
    while True:
        products_batch = list(db.aql.execute(aql_products, bind_vars={"category": category, "batch_size": batch_size}))
        if not products_batch:
            break
            
        # Prepare text for embedding
        product_texts = []
        product_keys = []
        for product in products_batch:
            # Combine title, features, and description
            text = f"{product.get('title', '')} {product.get('features_text', '')} {product.get('description', '')}"
            product_texts.append(text)
            product_keys.append(product["_key"])
        
        # Generate embeddings
        try:
            embeddings = embeddings_model.embed_documents(product_texts)
            
            # Update products with embeddings
            for i, key in enumerate(product_keys):
                db.collection("Products").update({
                    "_key": key,
                    "embedding": embeddings[i]
                })
            print(f"Added embeddings to {len(product_keys)} products")
        except Exception as e:
            print(f"Error generating product embeddings: {e}")
    
    # Query reviews for products in this category
    aql_reviews = """
    FOR r IN Reviews
        FILTER EXISTS(FOR p IN Products FILTER p._key == r.asin AND p.main_category == @category RETURN 1)
        AND NOT HAS(r, "embedding")
        LIMIT @batch_size
        RETURN r
    """
    
    # Process reviews in batches
    while True:
        reviews_batch = list(db.aql.execute(aql_reviews, bind_vars={"category": category, "batch_size": batch_size}))
        if not reviews_batch:
            break
            
        # Prepare text for embedding
        review_texts = []
        review_keys = []
        for review in reviews_batch:
            text = f"{review.get('title', '')} {review.get('text', '')}"
            review_texts.append(text)
            review_keys.append(review["_key"])
        
        # Generate embeddings
        try:
            embeddings = embeddings_model.embed_documents(review_texts)
            
            # Update reviews with embeddings
            for i, key in enumerate(review_keys):
                db.collection("Reviews").update({
                    "_key": key,
                    "embedding": embeddings[i]
                })
            print(f"Added embeddings to {len(review_keys)} reviews")
        except Exception as e:
            print(f"Error generating review embeddings: {e}")

# Optional: Visualize a subset of the graph
def visualize_graph_sample():
    """Visualize a small sample of the graph"""
    # Get a sample of products
    products = list(db.collection("Products").all().limit(5))
    product_asins = [p["_key"] for p in products]
    
    # Create a small NetworkX graph for visualization
    G = nx.Graph()
    
    # Add product nodes
    for product in products:
        G.add_node(product["_key"], type="product", label=product["title"][:20])
    
    # Get reviews for these products
    for asin in product_asins:
        reviews = db.aql.execute(
            "FOR r IN Reviews FILTER r.asin == @asin LIMIT 3 RETURN r",
            bind_vars={"asin": asin}
        )
        
        # Add review nodes and edges
        for review in reviews:
            G.add_node(review["_key"], type="review", label="Review")
            G.add_edge(asin, review["_key"], type="has_review")
            
            # Add user node and edge
            user_id = review["user_id"]
            G.add_node(user_id, type="user", label=f"User")
            G.add_edge(review["_key"], user_id, type="written_by")
    
    # Draw the graph
    plt.figure(figsize=(12, 8))
    pos = nx.spring_layout(G, seed=42)
    
    # Draw nodes with different colors by type
    node_colors = {
        "product": "skyblue",
        "review": "lightgreen",
        "user": "salmon"
    }
    
    for node_type, color in node_colors.items():
        nodes = [n for n, data in G.nodes(data=True) if data.get("type") == node_type]
        nx.draw_networkx_nodes(G, pos, nodelist=nodes, node_color=color, node_size=300)
    
    # Draw edges
    nx.draw_networkx_edges(G, pos)
    
    # Draw labels
    labels = {n: data.get("label", n) for n, data in G.nodes(data=True)}
    nx.draw_networkx_labels(G, pos, labels, font_size=8)
    
    plt.title("Sample of Amazon Reviews Graph")
    plt.axis('off')
    plt.tight_layout()
    plt.show()

# Process all categories (comment this out for testing or to process just a subset)
# process_all_categories(download_links, limit=5)  # Process just the first 5 categories

# To process just one category for testing
# process_all_categories({CATEGORY: download_links[CATEGORY]})

# Uncomment to visualize a sample of the graph
# visualize_graph_sample()

print("Script is ready to process all Amazon product categories.")
print("To run the full processing, uncomment the process_all_categories() line.")
print("You can set a limit to process only a subset of categories for testing.")
print("Make sure to set your OpenAI API key for embedding generation.")

