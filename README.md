# Revi - Reviews at a Glance

Revi is a bot to quickly check, summarize and present reviews of a product with just one photo or text, able to suggest alternatives and compare prices.

## Overview

Revi, the Review Bot is an AI-powered application that helps users get product information, reviews, and comparisons by simply uploading a photo or sending a text query. The system leverages vector search, graph databases, and AI to provide comprehensive product analysis.

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

## Key Features

- Product identification from images
- Natural language query support
- Review summarization
- Alternative product suggestions
- Price comparison
- Conversation history management
- Product graph network analysis

## API Endpoints

### Chat Endpoints

- `POST /chat`: Process text messages
- `POST /chat/image`: Process messages with images
- `POST /chat/clear`: Clear chat history

### Image Processing

- `POST /image/process`: Process product images and return information

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
4. **Simulated Internet Search**: Provides information not in the database

## Development Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables:
   - `OPENAI_API_KEY`: For GPT and embeddings
   - `ARANGO_URL`: ArangoDB connection URL
   - `ARANGO_DB`: Database name
   - `ARANGO_USERNAME`: Database username
   - `ARANGO_DB_PASS`: Database password
4. Run the server with `npm start`

## Environment Variables

```plaintext
OPENAI_API_KEY=your_openai_api_key
ARANGO_URL=https://your_arango_instance.arangodb.cloud:8529
ARANGO_DB=_system
ARANGO_USERNAME=root
ARANGO_DB_PASS=your_password
```

## Future Enhancements

- Improved image recognition
- Real-time price tracking
- User preference learning
- Mobile app optimization
- Integration with more e-commerce platforms

## License

Proprietary and Confidential

This code and documentation are proprietary and confidential. All rights reserved.

Any use, modification, or distribution of this software requires explicit written permission from the author(s). Developers must reach out directly to obtain permission before using or modifying any part of this codebase.

---

Created with ❤️ by the Baranki Team
