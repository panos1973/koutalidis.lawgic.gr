"use server";
import { Client } from "@elastic/elasticsearch";

// Create a singleton Elasticsearch client
let client: Client | null = null;

export const getElasticsearchClient = async () => {
  if (!client) {
    // Check if environment variables exist
    if (
      !process.env.ELASTICSEARCH_CLOUD_ID ||
      !process.env.ELASTICSEARCH_API_KEY
    ) {
      throw new Error(
        "Elasticsearch configuration missing: Please set ES_CLOUD_ID and ES_API_KEY environment variables"
      );
    }

    client = new Client({
      cloud: {
        id: process.env.ELASTICSEARCH_CLOUD_ID,
      },
      auth: {
        apiKey: process.env.ELASTICSEARCH_API_KEY,
      },
    });
  }
  return client;
};

// Create an index for a user if it doesn't exist
export const createUserIndex = async (userId: string) => {
  const client = await getElasticsearchClient();
  // Ensure the index name is lowercase and sanitize any invalid characters
  const sanitizedUserId = userId.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const indexName = `user_docs_${sanitizedUserId}`;

  try {
    const indexExists = await client.indices.exists({ index: indexName });

    if (!indexExists) {
      await client.indices.create({
        index: indexName,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
          },
          mappings: {
            properties: {
              content: {
                type: "text",
              },
              embedding: {
                type: "dense_vector",
                dims: 1024, // Voyage embeddings are 1024-dimensional
                index: true,
                similarity: "dot_product",
              },
              metadata: {
                type: "object",
                properties: {
                  fileName: { type: "keyword" },
                  caseStudyId: { type: "keyword" },
                  fileType: { type: "keyword" },
                  fileSize: { type: "keyword" },
                  uploadDate: { type: "date" },
                },
              },
            },
          },
        },
      });
    }

    return indexName;
  } catch (error) {
    console.error("Error creating Elasticsearch index:", error);
    throw error;
  }
};
