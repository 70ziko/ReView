#!/usr/bin/env python
# coding: utf-8

# # Amazon Reviews GraphRAG Implementation
# 
# This notebook implements a GraphRAG system for Amazon product reviews using ArangoDB
# for graph storage and querying, and LangChain/LangGraph for the agentic components.
# 
# # Step 0: Package Installation & Setup
# -----------------------------------

# In[2]:


get_ipython().run_line_magic('pip', 'install nx-arangodb langchain langchain-community langchain-openai langgraph')
get_ipython().run_line_magic('pip', 'install pandas numpy matplotlib tqdm openai')


# In[3]:


get_ipython().run_line_magic('pip', 'install python-dotenv')


# In[2]:


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
from dotenv import load_dotenv

# For the agentic components
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.graphs import ArangoGraph
from langchain_community.chains.graph_qa.arangodb import ArangoGraphQAChain
from langchain_core.tools import tool
from langchain_community.vectorstores.chroma import Chroma


# In[4]:


load_dotenv()

# Connect to the ArangoDB database
client = ArangoClient(hosts="https://17c43fa12737.arangodb.cloud:8529")
db = client.db("_system", username="root", password=os.getenv("ARANGO_DB_ROOT_PASS"), verify=True)

print(f"Connected to ArangoDB: {client.version}")


# # Step 1: Load and Transform the Amazon Review Data
# ------------------------------------------------

# In[6]:


import os
import gzip
import urllib.request
import time
from tqdm import tqdm
import ssl

def download_file(url, target_path):
    """Download a file from URL to target path with progress bar"""
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    
    if os.path.exists(target_path):
        print(f"File already exists: {target_path}")
        return target_path
    
    print(f"Downloading {url} to {target_path}")
    
    try:
        # Disable SSL verification
        ssl._create_default_https_context = ssl._create_unverified_context
        
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


# In[7]:


# Create data directories
DATA_DIR = "amazon_data"
DOWNLOAD_DIR = os.path.join(DATA_DIR, "downloaded")
EXTRACTED_DIR = os.path.join(DATA_DIR, "extracted")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)
os.makedirs(EXTRACTED_DIR, exist_ok=True)

# Parse download links
download_links = parse_download_links("dataset_urls.txt")
print(f"Found {len(download_links)} category download links")

# Metadata URL pattern
# Assuming metadata URLs follow the same pattern with 'meta_' prefix
META_URL_BASE = "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/raw/meta_categories/meta_"


# In[8]:


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


# # Process categories
# For testing, we'll just process one category first

# In[9]:


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


# 
# # Step 2: Create and Configure the ArangoDB Graph
# -----------------------------------------------
# 

# In[44]:


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


# # Step 3: Transform and Insert the Data
# ------------------------------------

# In[ ]:


# Function to sanitize keys for ArangoDB
def sanitize_key(key, allow_spaces=False):
    """Sanitize a string to be used as a key in ArangoDB"""
    if not key:
        return ''
    
    # Convert to string if not already
    key = str(key)
    
    # Replace problematic characters
    key = key.replace('/', '_').replace('\\', '_').replace('.', '_')
    
    # Replace spaces if not allowed
    if not allow_spaces:
        key = key.replace(' ', '_')
    
    # Remove any other potentially problematic characters
    # ArangoDB keys must be URL-safe
    import re
    key = re.sub(r'[^a-zA-Z0-9_\-]', '_', key)
    
    # Ensure the key is not empty and doesn't start with a number or underscore
    if not key or key[0].isdigit() or key[0] == '_':
        key = 'a' + key
    
    return key

# Prepare products data
def prepare_products_data(metadata_list):
    """Transform metadata into a format suitable for Products collection"""
    print(f"Processing {len(metadata_list)} metadata items")
    
    # Debug: Print a sample item to see its structure
    if metadata_list and len(metadata_list) > 0:
        print("Sample metadata item structure:", list(metadata_list[0].keys()))
    
    products = []
    skipped_items = 0
    
    for item in metadata_list:
        # Use parent_asin as the primary identifier
        # In the Amazon data, this appears to be the product ID
        item_id = item.get('parent_asin')
        
        # Skip items without an identifier
        if not item_id:
            skipped_items += 1
            continue
            
        # Sanitize the ID for use as key
        asin = sanitize_key(item_id)
        if not asin:
            skipped_items += 1
            continue
        
        # Combine description into a single string if it's a list
        description = ''
        if isinstance(item.get('description', []), list):
            # Filter out None values and join
            desc_items = [d for d in item.get('description', []) if d]
            description = ' '.join(desc_items)
        else:
            description = str(item.get('description', ''))
        
        # Extract features as a list and handle potential None values
        features = []
        if isinstance(item.get('features', []), list):
            features = [f for f in item.get('features', []) if f]
        
        # Join features for text search
        features_text = ' '.join(features) if features else ''
        
        # Sanitize main_category for use in category edges
        main_category = item.get('main_category', '')
        if main_category:
            main_category = sanitize_key(main_category, allow_spaces=True)
        
        # Extract image URLs, handling potential None values
        images = []
        if isinstance(item.get('images', []), list):
            for img in item.get('images', []):
                if isinstance(img, dict) and 'large' in img and img['large']:
                    images.append(img['large'])
                    if len(images) >= 3:
                        break
        
        # Handle potential None or invalid values for numeric fields
        try:
            price = float(item.get('price', 0)) if item.get('price') is not None else 0
        except (ValueError, TypeError):
            price = 0
            
        try:
            avg_rating = float(item.get('average_rating', 0)) if item.get('average_rating') is not None else 0
        except (ValueError, TypeError):
            avg_rating = 0
            
        try:
            rating_count = int(item.get('rating_number', 0)) if item.get('rating_number') is not None else 0
        except (ValueError, TypeError):
            rating_count = 0
        
        # Prepare product document with sanitized values
        product = {
            "_key": asin,
            "original_id": item_id,  # Keep original ID for reference
            "title": str(item.get('title', '')),
            "main_category": main_category,
            "description": description,
            "features": features,
            "features_text": features_text,
            "price": price,
            "average_rating": avg_rating,
            "rating_count": rating_count,
            "store": str(item.get('store', '')),
            "details": item.get('details', {}),
            "parent_asin": asin, 
            "bought_together": item.get('bought_together', []),
            "images": images
        }
        products.append(product)
    
    print(f"Transformed {len(products)} products (skipped {skipped_items} items)")
    return products

# Prepare reviews data
def prepare_reviews_data(reviews_list):
    """Transform reviews into a format suitable for Reviews collection"""
    print(f"Processing {len(reviews_list)} review items")
    
    # Debug: Print a sample item structure
    if reviews_list and len(reviews_list) > 0:
        print("Sample review item structure:", list(reviews_list[0].keys()))
    
    reviews = []
    skipped_items = 0
    
    for item in reviews_list:
        # Check if we have necessary fields
        asin_value = item.get('asin')
        user_id_value = item.get('user_id')
        
        if not asin_value or not user_id_value:
            skipped_items += 1
            continue
        
        # Sanitize the ASIN and user_id
        asin = sanitize_key(asin_value)
        user_id = sanitize_key(user_id_value)
        
        if not asin or not user_id:
            skipped_items += 1
            continue
        
        # Create a unique key for the review
        timestamp = item.get('sort_timestamp', 0)
        # Ensure timestamp is a number
        if not timestamp:
            timestamp = 0
        try:
            timestamp = int(timestamp)
        except (ValueError, TypeError):
            timestamp = 0
            
        # Create a unique but valid key
        key = f"{asin}_{user_id}_{timestamp}"
        key = sanitize_key(key)
        
        # Extract image URLs if available
        images = []
        if isinstance(item.get('images', []), list):
            for img in item.get('images', []):
                if isinstance(img, dict) and 'large_image_url' in img and img['large_image_url']:
                    images.append(img['large_image_url'])
        
        # Sanitize parent_asin
        parent_asin = sanitize_key(item.get('parent_asin', ''))
        
        # Handle potential None or invalid values for numeric fields
        try:
            rating = float(item.get('rating', 0)) if item.get('rating') is not None else 0
        except (ValueError, TypeError):
            rating = 0
            
        try:
            helpful_votes = int(item.get('helpful_votes', 0)) if item.get('helpful_votes') is not None else 0
        except (ValueError, TypeError):
            helpful_votes = 0
        
        # Prepare review document with sanitized values
        review = {
            "_key": key,
            "asin": asin,
            "original_asin": asin_value,  # Keep original for reference
            "user_id": user_id,
            "original_user_id": user_id_value,  # Keep original for reference
            "parent_asin": parent_asin,
            "original_parent_asin": item.get('parent_asin', ''),  # Keep original for reference
            "rating": rating,
            "title": str(item.get('title', '')),
            "text": str(item.get('text', '')),
            "timestamp": timestamp,
            "helpful_votes": helpful_votes,
            "verified_purchase": bool(item.get('verified_purchase', False)),
            "images": images
        }
        reviews.append(review)
    
    print(f"Transformed {len(reviews)} reviews (skipped {skipped_items} items)")
    return reviews

# Extract users from reviews
def extract_users(reviews_list):
    """Extract unique users from reviews data"""
    users = {}
    for review in reviews_list:
        user_id = review.get('user_id', '')
        original_user_id = review.get('original_user_id', '')
        
        if user_id and user_id not in users:
            users[user_id] = {
                "_key": user_id,
                "original_user_id": original_user_id,
                "review_count": 1
            }
        elif user_id:
            users[user_id]["review_count"] += 1
    return list(users.values())

# Extract categories from products
def extract_categories(products_list):
    """Extract unique categories from product metadata"""
    print(f"Extracting categories from {len(products_list)} products")
    
    categories = {}
    for product in products_list:
        main_category = product.get('main_category', '')
        
        if main_category and main_category not in categories:
            # Sanitize key for ArangoDB
            category_key = sanitize_key(main_category)
            
            categories[main_category] = {
                "_key": category_key,
                "name": main_category,
                "level": 0  # Top level category
            }
        
        # Process hierarchical categories if available
        if 'categories' in product and isinstance(product['categories'], list) and product['categories']:
            for i, category_list in enumerate(product['categories']):
                if isinstance(category_list, list) and category_list:
                    for j, category in enumerate(category_list):
                        if category and category not in categories:
                            # Sanitize key for ArangoDB
                            category_key = sanitize_key(category)
                            
                            categories[category] = {
                                "_key": category_key,
                                "name": category,
                                "level": j+1  # Level in hierarchy
                            }
    
    categories_list = list(categories.values())
    print(f"Extracted {len(categories_list)} unique categories")
    return categories_list

# Create edge data
def create_has_review_edges(reviews):
    """Create edges connecting products to reviews"""
    edges = []
    product_keys = set()  # Keep track of valid product keys
    
    # Get all valid product keys from the database
    try:
        products_cursor = db.collection("Products").all()
        for product in products_cursor:
            product_keys.add(product["_key"])
    except Exception as e:
        print(f"Error fetching product keys: {e}")
    
    for review in reviews:
        product_key = review['asin']
        review_key = review['_key']
        
        # Only create edge if product exists
        if product_key in product_keys:
            edge = {
                "_from": f"Products/{product_key}",
                "_to": f"Reviews/{review_key}"
            }
            edges.append(edge)
    
    print(f"Created {len(edges)} HasReview edges (out of {len(reviews)} reviews)")
    return edges

def create_written_by_edges(reviews):
    """Create edges connecting reviews to users"""
    edges = []
    user_keys = set()  # Keep track of valid user keys
    
    # Get all valid user keys from the database
    try:
        users_cursor = db.collection("Users").all()
        for user in users_cursor:
            user_keys.add(user["_key"])
    except Exception as e:
        print(f"Error fetching user keys: {e}")
    
    for review in reviews:
        review_key = review['_key']
        user_key = review['user_id']
        
        # Only create edge if user exists
        if user_key in user_keys:
            edge = {
                "_from": f"Reviews/{review_key}",
                "_to": f"Users/{user_key}"
            }
            edges.append(edge)
    
    print(f"Created {len(edges)} WrittenBy edges (out of {len(reviews)} reviews)")
    return edges

def create_belongs_to_category_edges(products):
    """Create edges connecting products to categories"""
    edges = []
    product_keys = set()  # Keep track of valid product keys
    category_keys = set()  # Keep track of valid category keys
    
    # Get all valid product keys from the database
    try:
        products_cursor = db.collection("Products").all()
        for product in products_cursor:
            product_keys.add(product["_key"])
    except Exception as e:
        print(f"Error fetching product keys: {e}")
    
    # Get all valid category keys from the database
    try:
        categories_cursor = db.collection("Categories").all()
        for category in categories_cursor:
            category_keys.add(category["_key"])
    except Exception as e:
        print(f"Error fetching category keys: {e}")
    
    for product in products:
        product_key = product['_key']
        if product.get('main_category') and product_key in product_keys:
            # Sanitize category key
            category_key = sanitize_key(product['main_category'])
            
            # Only create edge if both product and category exist
            if category_key in category_keys:
                edge = {
                    "_from": f"Products/{product_key}",
                    "_to": f"Categories/{category_key}"
                }
                edges.append(edge)
    
    print(f"Created {len(edges)} BelongsToCategory edges (out of {len(products)} products)")
    return edges

def create_variant_of_edges(products):
    """Create edges connecting product variants"""
    edges = []
    product_keys = set()  # Keep track of valid product keys
    
    # Get all valid product keys from the database
    try:
        products_cursor = db.collection("Products").all()
        for product in products_cursor:
            product_keys.add(product["_key"])
    except Exception as e:
        print(f"Error fetching product keys: {e}")
    
    for product in products:
        product_key = product['_key']
        parent_key = product.get('parent_asin')
        
        # Only create edge if both product and parent exist and are different
        if (parent_key and parent_key != product_key and 
            product_key in product_keys and parent_key in product_keys):
            edge = {
                "_from": f"Products/{product_key}",
                "_to": f"Products/{parent_key}"
            }
            edges.append(edge)
    
    print(f"Created {len(edges)} VariantOf edges (out of {len(products)} products)")
    return edges

# Insert data into ArangoDB collections
def insert_documents(collection_name, documents, batch_size=100):
    """Insert documents into a collection with batch processing"""
    if not documents:
        print(f"No documents to insert into {collection_name}")
        return
        
    collection = db.collection(collection_name)
    
    # Process in batches to avoid memory issues with large datasets
    successful_inserts = 0
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i+batch_size]
        try:
            result = collection.import_bulk(batch, on_duplicate="update")
            successful_inserts += result["created"] + result["updated"]
        except Exception as e:
            print(f"Error inserting batch into {collection_name}: {e}")
    
    print(f"Successfully inserted/updated {successful_inserts} documents in {collection_name}")

# Transform the data with sanitized keys
products = prepare_products_data(metadata_data)
reviews = prepare_reviews_data(reviews_data)
users = extract_users(reviews)
categories = extract_categories(products)

# Insert node data
print("Inserting product data...")
insert_documents("Products", products)

print("Inserting review data...")
insert_documents("Reviews", reviews)

print("Inserting user data...")
insert_documents("Users", users)

print("Inserting category data...")
insert_documents("Categories", categories)

# Create edge data (after nodes have been inserted)
# This ensures we only create edges between existing nodes
has_review_edges = create_has_review_edges(reviews)
written_by_edges = create_written_by_edges(reviews)
belongs_to_category_edges = create_belongs_to_category_edges(products)
variant_of_edges = create_variant_of_edges(products)

# Insert edge data
print("Creating product-review connections...")
insert_documents("HasReview", has_review_edges)

print("Creating review-user connections...")
insert_documents("WrittenBy", written_by_edges)

print("Creating product-category connections...")
insert_documents("BelongsToCategory", belongs_to_category_edges)

print("Creating product variant connections...")
insert_documents("VariantOf", variant_of_edges)


# # Step 4: Create the NetworkX Integration (for Graph Analytics)
# ------------------------------------------------------------

# In[1]:


# Create the NetworkX graph from ArangoDB
G_adb = nxadb.Graph(name=GRAPH_NAME, db=db)

print(G_adb)


# # Step 5: Generate and Store Embeddings
# ------------------------------------
# 

# In[ ]:


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
        products_batch = list(products_collection.all(limit=batch_size, skip=i))
        
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
        reviews_batch = list(reviews_collection.all(limit=batch_size, skip=i))
        
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


# # Step 6: Build the Agentic App with LangChain & LangGraph
# -------------------------------------------------------

# In[ ]:


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


# # Step 7: Testing the GraphRAG System
# ----------------------------------

# In[ ]:


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


# # Step 8: Process Multiple Categories
# -----------------------------

# In[ ]:


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


# In[ ]:


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

