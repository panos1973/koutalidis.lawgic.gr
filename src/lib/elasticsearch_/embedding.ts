"use server";
import { getElasticsearchClient, createUserIndex } from "./client";
import { v4 as uuidv4 } from "uuid";

// Generate embeddings using Voyage AI REST API
const generateEmbeddings = async (text: string): Promise<number[]> => {
  try {
    if (!process.env.VOYAGE_API_KEY) {
      throw new Error("Voyage API key not found in environment variables");
    }

    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: text,
        model: "voyage-3",
        input_type: "document",
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Voyage API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("Error generating embeddings with Voyage AI:", error);
    throw error;
  }
};

// Add documents to Elasticsearch
export const addDocumentsToElasticsearch = async (
  userId: string,
  documents: Array<{
    pageContent: string;
    metadata: any;
  }>
) => {
  try {
    if (!userId) {
      console.warn("No userId provided, using anonymous");
      userId = "anonymous";
    }

    const client = await getElasticsearchClient();
    const indexName = await createUserIndex(userId);

    const operations = [];

    for (const doc of documents) {
      try {
        const embedding = await generateEmbeddings(doc.pageContent);

        operations.push({
          index: {
            _index: indexName,
            _id: uuidv4(),
          },
        });

        operations.push({
          content: doc.pageContent,
          embedding: embedding,
          metadata: {
            ...doc.metadata,
            uploadDate: new Date().toISOString(),
          },
        });
      } catch (innerError) {
        console.error("Error processing document:", innerError);
        // Continue with other documents
      }
    }

    if (operations.length > 0) {
      const result = await client.bulk({ operations });
      await client.indices.refresh({ index: indexName });
      return result;
    } else {
      console.warn("No operations to perform");
      return null;
    }
  } catch (error) {
    console.error("Error adding documents to Elasticsearch:", error);
    throw error;
  }
};

// Search for similar documents
export const searchSimilarDocuments = async (
  userId: string,
  query: string,
  k: number = 5
) => {
  try {
    if (!userId) {
      console.warn("No userId provided, using anonymous");
      userId = "anonymous";
    }

    const client = await getElasticsearchClient();
    // Use the same sanitization for consistency
    const sanitizedUserId = userId.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const indexName = `user_docs_${sanitizedUserId}`;

    // Check if index exists
    const indexExists = await client.indices.exists({ index: indexName });
    if (!indexExists) {
      console.warn(`Index ${indexName} does not exist`);
      return [];
    }

    const embedding = await generateEmbeddings(query);

    const result = await client.search({
      index: indexName,
      body: {
        knn: {
          field: "embedding",
          query_vector: embedding,
          k: k,
          num_candidates: k * 5,
        },
        _source: ["content", "metadata"],
      },
    });

    return result.hits.hits.map((hit: any) => ({
      pageContent: hit._source.content,
      metadata: hit._source.metadata,
    }));
  } catch (error) {
    console.error("Error searching similar documents:", error);
    return [];
  }
};
