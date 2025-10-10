"use server";
import { VoyageEmbeddings } from "@langchain/community/embeddings/voyage";
import {
  ElasticVectorSearch,
  type ElasticClientArgs,
} from "@langchain/community/vectorstores/elasticsearch";
import { Client } from "@elastic/elasticsearch";
import { Document } from "langchain/document";

const ELASTIC_INDEX = "user_library_files";

// Create a singleton for the Elasticsearch vector store
let vectorStore: ElasticVectorSearch | null = null;

/**
 * Get or create an ElasticVectorSearch instance for library files
 */
export const getLibraryVectorStore = async () => {
  if (!vectorStore) {
    const elasticClient = new Client({
      cloud: {
        id: process.env.ELASTICSEARCH_CLOUD_ID!,
      },
      auth: {
        apiKey: process.env.ELASTICSEARCH_API_KEY!,
      },
    });

    const clientArgs: ElasticClientArgs = {
      client: elasticClient,
      indexName: ELASTIC_INDEX,
    };

    const embeddings = new VoyageEmbeddings({
      apiKey: process.env.VOYAGE_API_KEY!,
      inputType: "document",
    });

    vectorStore = new ElasticVectorSearch(embeddings, clientArgs);
  }

  return vectorStore;
};

/**
 * Add documents to the Elasticsearch index
 */
export const addDocumentsToLibraryIndex = async (
  documents: Document[],
  ids?: string[]
) => {
  try {
    const store = await getLibraryVectorStore();
    return await store.addDocuments(documents, { ids });
  } catch (error) {
    console.error("Error adding documents to library index:", error);
    throw error;
  }
};

/**
 * Search for similar documents in the library index
 */
export const searchLibraryDocuments = async (
  query: string,
  k: number = 5,
  filter?: any[]
) => {
  try {
    const store = await getLibraryVectorStore();
    return await store.similaritySearch(query, k, filter);
  } catch (error) {
    console.error("Error searching library documents:", error);
    throw error;
  }
};

/**
 * Delete documents from the library index
 */
export const deleteLibraryDocuments = async (ids: string[]) => {
  try {
    const store = await getLibraryVectorStore();
    return await store.delete({ ids });
  } catch (error) {
    console.error("Error deleting library documents:", error);
    throw error;
  }
};
