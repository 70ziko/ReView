# Revi - Reviews at a Glance

Revi is an AI-powered application that helps users get product information, reviews, alternatives and comparisons by simply uploading a photo or sending a text query. The system leverages vector search, graph databases, google lens with SerpAPI (needs public image urls) and AI to provide comprehensive product analysis in mere seconds. The goal is to increase consumers awareness when buying in physical shops.

## Architecture

The system follows a client-server architecture with the following components:

1. **Client**: A mobile app where users can take pictures of products or enter text queries
2. **Server**: Processes requests and interacts with various APIs and databases
3. **AI Integration**: Uses OpenAI's GPT models for natural language processing
4. **Database**: ArangoDB graph database for product and review data
5. **Image Analysis**: Google Lens API integration for product recognition from images

### Flow

1. User sends a photo for review through the app
2. Server receives the photo
3. Image is sent to Google Lens API for product identification
4. Product information is retrieved from the database using vector search
5. GPT constructs a comprehensive response with:
   - Product details
   - Summarized reviews
   - Sources of the reviews
   - Alternative product suggestions
   - Price comparisons

## Technology Stack

- **Backend**: Node.js with Express
- **Database**: ArangoDB (graph database)
- **AI Models**: OpenAI GPT-4o
- **Vector Embeddings**: OpenAI Embeddings API
- **Image Recognition**: Google Lens API
- **TypeScript**: For type-safe code

## Data Structure

The system returns product information in the following JSON format:

```json
{
  "product_name": "Premium Bluetooth Headphones",
  "score": 85,
  "image_url": "https://example.com/images/headphones.jpg",
  "general_review": "High-quality wireless headphones with excellent sound quality and comfortable fit. Battery life could be improved.",
  "amazon_reviews_ref": "https://amazon.com/product/123456/reviews",
  "alternatives": [
    {
      "name": "Budget Bluetooth Headphones",
      "product_id": "BT78901",
      "score": 72
    },
    {
      "name": "Premium Wired Headphones",
      "product_id": "WH45678",
      "score": 88
    }
  ],
  "prices": {
    "min": 79.99,
    "avg": 94.50
  },
  "product_id": "BT12345",
  "category": "Electronics/Audio/Headphones"
}
```

## Database Schema

### Node Collections

- `Products`: Product information
- `Reviews`: User reviews for products
- `Users`: User data
- `Categories`: Product categories

### Edge Collections

- `HasReview`: Links products to reviews
- `WrittenBy`: Links reviews to users
- `BelongsToCategory`: Links products to categories
- `VariantOf`: Links product variants

## AI Capabilities

The system uses several AI tools:

1. **Product Search by Description**: Vector similarity search on product embeddings
2. **Review Retrieval**: Gets the most helpful reviews for a product
3. **Product Network Analysis**: Analyzes related products, popular items, and patterns
4. **Internet Search**: Provides information not found in the database

## Development Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables:
   - `cp .env.template .env`
   - Replace values with your own API keys
4. Run the server with `npm run dev`

## License

Proprietary Software

This code and documentation are proprietary.

Any use, modification, or distribution of this software requires explicit written permission from the author Patryk Fidler. Developers must reach out directly to obtain permission before using or modifying any part of this codebase.

All rights otherwise reserved.

---

Created with ❤️ by the Baranki Team
