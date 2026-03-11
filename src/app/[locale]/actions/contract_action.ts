'use server'

import db from '@/db/drizzle'
import {
  getLongRunningPoller,
  AnalyzeResultOperationOutput,
  isUnexpected,
} from '@azure-rest/ai-document-intelligence'
import DocumentIntelligence from '@azure-rest/ai-document-intelligence'
import { AzureKeyCredential } from '@azure/core-auth'
import { generateObject, generateText } from 'ai'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  contract,
  contract_data_fields,
  contract_drafts,
  contract_files,
  contract_sections,
  user_contract_chat_preferences,
} from '@/db/schema'
import { getLLMModel } from '@/lib/models/llmModelFactory'
import { cookies } from 'next/headers'
import { OpenAIEmbeddings } from '@langchain/openai'
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector'
import pg from 'pg'
import { Document } from 'langchain/document'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

let cachedLLMModelForTitle: any = null
let cachedLLMModelForSections: any = null
let cachedDocumentIntelligenceClient: any = null

const getLocaleFromCookies = () => {
  const cookieStore = cookies()
  const localeCookie = cookieStore.get('NEXT_LOCALE')
  return localeCookie ? localeCookie.value : 'el' // Default to Greek
}

// Cache and reuse the LLM model for generating titles
const getCachedLLMModelForTitle = async () => {
  if (!cachedLLMModelForTitle) {
    cachedLLMModelForTitle = await getLLMModel('claude-haiku-4-5-20251001')
  }
  return cachedLLMModelForTitle
}

// Cache and reuse the LLM model for generating contract sections
const getCachedLLMModelForSections = async () => {
  if (!cachedLLMModelForSections) {
    cachedLLMModelForSections = await getLLMModel('claude-sonnet-4-6')
  }
  return cachedLLMModelForSections
}

// Cache and reuse the Document Intelligence client for document analysis
const getDocumentIntelligenceClient = () => {
  if (!cachedDocumentIntelligenceClient) {
    const endpoint = process.env.DI_ENDPOINT
    const key = process.env.DI_KEY
    cachedDocumentIntelligenceClient = DocumentIntelligence(
      endpoint!,
      new AzureKeyCredential(key!)
    )
  }
  return cachedDocumentIntelligenceClient
}

export const getContractChatPreferences = async (userId: string) => {
  const prefs = await db
    .select()
    .from(user_contract_chat_preferences)
    .where(eq(user_contract_chat_preferences.userId, userId))
    .limit(1)

  if (prefs.length === 0) {
    const defaultPrefs = await db
      .insert(user_contract_chat_preferences)
      .values({
        userId,
        includeGreekLaws: true,
        includeGreekCourtDecisions: true,
        includeEuropeanLaws: false,
        includeEuropeanCourtDecisions: false,
        includeGreekBibliography: false,
        includeForeignBibliography: false,
      })
      .returning()

    return defaultPrefs[0]
  }

  return prefs[0]
}

export const updateContractChatPreferences = async (
  userId: string,
  preferences: {
    includeGreekLaws?: boolean
    includeGreekCourtDecisions?: boolean
    includeEuropeanLaws?: boolean
    includeEuropeanCourtDecisions?: boolean
    includeGreekBibliography?: boolean
    includeForeignBibliography?: boolean
  }
) => {
  const locale = getLocaleFromCookies()
  await db
    .update(user_contract_chat_preferences)
    .set({
      ...preferences,
      updatedAt: new Date(),
    })
    .where(eq(user_contract_chat_preferences.userId, userId))

  revalidatePath(`/${locale}/contract-chat`)
}

export const getContracts = async (userId: string) => {
  return await db
    .select()
    .from(contract)
    .where(eq(contract.userId, userId))
    .orderBy(desc(contract.createdAt))
}

export const updateContractNote = async (contractId: string, note: string) => {
  const locale = getLocaleFromCookies()
  await db.update(contract).set({ note }).where(eq(contract.id, contractId))

  revalidatePath(`/${locale}/contract`)
  revalidatePath(`/${locale}/contract/${contractId}`)
}

export const getAcontractFile = async (contractId: string) => {
  return await db
    .select()
    .from(contract_files)
    .where(eq(contract_files.contract_id, contractId))
  // .limit(1)
}

export const createContract = async (userId: string) => {
  const locale = getLocaleFromCookies()
  const data = await db
    .insert(contract)
    .values({ userId, title: generateContractTitle(locale) })
    .returning({ contractId: contract.id })
  const contractId = data[0].contractId
  revalidatePath(`/${locale}/contract/`)
  return contractId
  //   redirect(`/contract/${contactChatId}`);
}

export const createMeaningfulContractTitle = async (
  contractId: string,
  context: string
) => {
  const locale = getLocaleFromCookies()
  const selectedModel = await getCachedLLMModelForTitle()

  const { object: title } = await generateObject({
    model: selectedModel,
    system: `
      You can generate meaningful contract titles based on context.
      Titles must be compact and meaningful.
      Use the context provided to generate title.
      Titles must be no longer than 120 characters.
      The title should always be in ${locale === 'el' ? 'Greek' : 'English'}.
    `,
    prompt: `Generate a title based on this context: ${context}`,
    schema: z.object({
      title: z.string().describe('Title of the contract'),
    }),
  })

  await db
    .update(contract)
    .set({
      title: title.title,
    })
    .where(eq(contract.id, contractId))
  revalidatePath(`/${locale}/contract`)
  revalidatePath(`/${locale}/contract/${contractId}`)
}

const generateContractTitle = (locale: string) => {
  return locale === 'el'
    ? `Σύμβαση ${Math.floor(Math.random() * 10000).toFixed(0)}`
    : `Contract ${Math.floor(Math.random() * 10000).toFixed(0)}`
}

export const deleteContract = async (contractId: string) => {
  const locale = getLocaleFromCookies()
  await db.delete(contract).where(eq(contract.id, contractId))
  revalidatePath(`/${locale}/contract`)
  redirect(`/${locale}/contract`)
}

export const getSectionsOfContract = async (contractId: string) => {
  return await db
    .select()
    .from(contract_sections)
    .where(eq(contract_sections.contractId, contractId))
    .orderBy(asc(contract_sections.createdAt))
}

export const getDataFieldsOfContracts = async (contractId: string) => {
  return await db
    .select()
    .from(contract_data_fields)
    .where(eq(contract_data_fields.contractId, contractId))
    .orderBy(asc(contract_data_fields.createdAt))
}

export const saveContractDataFieldValue = async (
  contractId: string,
  fieldId: string,
  value: string
) => {
  const locale = getLocaleFromCookies()
  await db
    .update(contract_data_fields)
    .set({
      value,
    })
    .where(eq(contract_data_fields.id, fieldId))
  revalidatePath(`/${locale}/contract/${contractId}`)
}

export const getContractDrafts = async (contractId: string) => {
  const drafts = await db
    .select()
    .from(contract_drafts)
    .where(eq(contract_drafts.contractId, contractId))
    .orderBy(asc(contract_drafts.createdAt))

  return drafts.map((draft) => {
    const match = draft.draft.match(/^\[(USER|ASSISTANT)\]\s*([\s\S]*)/)
    if (match) {
      return {
        ...draft,
        role: match[1].toLowerCase(),
        draft: match[2],
      }
    }
    return { ...draft, role: 'unknown' }
  })
}

export const addContractDraft = async (
  contractId: string,
  draft: string,
  role: 'user' | 'assistant'
) => {
  const locale = getLocaleFromCookies()
  const draftWithRole = `[${role.toUpperCase()}] ${draft}`
  await db.insert(contract_drafts).values({
    draft: draftWithRole,
    contractId,
  })
  revalidatePath(`/${locale}/contract/${contractId}`)
}

export const createSectionsOfContracts = async ({
  userId,
  contractId,
  base64Source,
  fileName,
  fileType,
  fileSize,
}: {
  userId: string
  contractId: string
  base64Source: string
  fileName: string
  fileType: string
  fileSize: number
}) => {
  const locale = getLocaleFromCookies()

  // First save the file and create embeddings
  const extractedText = await saveContractFile({
    contractId,
    base64Source,
    fileName,
    fileType,
    fileSize,
  })

  if (!extractedText) return

  // Then generate sections from the extracted text
  const generatedSections = await generateContractSections(extractedText)

  const sectionInserts = generatedSections.sections.map((section) =>
    db.insert(contract_sections).values({
      contractId,
      title: section,
      description: '',
    })
  )

  const fieldInserts = generatedSections.fields.map((field) =>
    db.insert(contract_data_fields).values({
      contractId,
      field_name: field.field_name,
      field_type: field.field_type,
    })
  )

  await Promise.all([...sectionInserts, ...fieldInserts])

  revalidatePath(`/${locale}/contract/${contractId}`)
}

const analyzeDocument = async (base64Source: string) => {
  // const endpoint = process.env.DI_ENDPOINT
  // const key = process.env.DI_KEY
  // const client = DocumentIntelligence(endpoint!, new AzureKeyCredential(key!))
  const client = getDocumentIntelligenceClient()
  try {
    const initialResponse = await client
      .path('/documentModels/{modelId}:analyze', 'prebuilt-layout')
      .post({
        contentType: 'application/json',
        body: {
          base64Source,
        },
        queryParameters: { locale: 'en-IN', outputContentFormat: 'markdown' },
      })

    if (isUnexpected(initialResponse)) {
      throw initialResponse.body.error
    }

    const poller = await getLongRunningPoller(client, initialResponse)
    const result = (await poller.pollUntilDone())
      .body as AnalyzeResultOperationOutput

    return result.analyzeResult?.content
  } catch (error) {
    console.error('Document analysis failed:', error)
    return null
  }
}

export const saveContractFile = async ({
  contractId,
  base64Source,
  fileName,
  fileType,
  fileSize,
}: {
  contractId: string
  base64Source: string
  fileName: string
  fileType: string
  fileSize: number
}) => {
  const locale = getLocaleFromCookies()
  const base64Content = base64Source.split(',')[1]

  // Extract text from document
  const extractedText = await analyzeDocument(base64Content)

  if (extractedText) {
    // Split document into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 6000,
      chunkOverlap: 100,
    })
    const splitDocuments = await splitter.splitText(extractedText)

    // Create documents for vector store
    const documents = splitDocuments.map(
      (doc) =>
        new Document({
          pageContent: doc,
          metadata: { fileName, contractId },
        })
    )

    // Store in vector database
    const vectorStore = await createContractVectorStore(contractId)
    await vectorStore.addDocuments(documents)

    // Save file metadata and content to database
    await db.insert(contract_files).values({
      file_content: extractedText,
      file_name: fileName,
      file_path: '',
      file_size: fileSize.toString(),
      file_type: fileType,
      file_blob: base64Source, // Save the complete base64 string including the data URI
      contract_id: contractId,
    })

    return extractedText
  }

  return null
}
const generateContractSections = async (contract: string) => {
  const selectedModel = await getCachedLLMModelForSections()

  const { object } = await generateObject({
    // model: await getLLMModel('claude-sonnet-4-6'),
    // model: openai("gpt-4o"),
    // schema: ContractSectionSchema,
    model: selectedModel,
    schema: z.object({
      sections: z.array(
        z.string().describe('Title of the section or header of the section')
      ),
      fields: z.array(
        z.object({
          field_name: z.string().describe('Field Name Eg: Contract Date'),
          field_type: z.string().describe('Field HTML input type Eg: date'),
        })
      ),
    }),
    maxTokens: 4000,
    system: `
Παρακαλώ επεξεργάσου το παρακάτω κείμενο σύμβασης και εντόπισε όλα τα κεφάλαια/τίτλους και υπότιτλους ακριβώς όπως εμφανίζονται, διατηρώντας ΑΥΣΤΗΡΑ την σειρά των τίτλων & υπότιτλων, την αρίθμηση και τη μορφοποίησή τους.

<contract_text>
{{CONTRACT_TEXT}}
</contract_text>

Ακολούθησε αυτά τα βήματα και πρόσεξε ιδιαίτερα να ΜΗΝ ανακατεύεις τη σειρά ή να αλλάξεις κάτι στους τίτλους/υπότιτλους:
1. Διάβασε προσεκτικά ολόκληρο το κείμενο.
2. Εντόπισε και κατέγραψε κάθε τίτλο & υπότιτλο, διατηρώντας την ακριβή τους διατύπωση και αρίθμηση.
3. Παρουσίασε τους τίτλους & υπότιτλους ακριβώς στη σειρά που εμφανίζονται στο κείμενο. 
   - Μην προσθέσεις ή αλλάξεις τίποτα (ούτε σημεία στίξης, ούτε διάστημα, ούτε αρίθμηση).
4. Στη συνέχεια, αναζήτησε τις βασικές μεταβλητές (π.χ. ονόματα αντισυμβαλλομένων, ημερομηνίες, διευθύνσεις, φορολογικά στοιχεία). Για κάθε μεταβλητή:
   - Απόδωσε ένα κατάλληλο πεδίο-όνομα (π.χ. "Όνομα Συμβαλλομένου", "Ημερομηνία Υπογραφής", "ΑΦΜ", "Έδρα Εταιρείας" κλπ.).
   - Δώσε έναν τύπο HTML (π.χ. "full name" για ονόματα, "date" για ημερομηνίες).
5. Αν δεν βρεις κάποια μεταβλητή, μην δημιουργήσεις hallucinated δεδομένα. Άφησε απλά την ενότητα κενού περιεχομένου.
6. Παρέδωσε το αποτέλεσμα αποκλειστικά στην εξής μορφή (όπως στο παράδειγμα που ακολουθεί) και μην προσθέσεις επεξηγήσεις:

<headers>
(Γράψε εδώ όλους τους τίτλους/υπότιτλους με την σειρά που αναφέρονται στο κείμενο της σύμβασης, ο καθένας σε ξεχωριστή γραμμή)
</headers>

<variables>
(Για κάθε μεταβλητή που βρέθηκε, γράψε μια γραμμή π.χ.:  "Όνομα Συμβαλλομένου: text",  "Ημερομηνία Υπογραφής: date" ...)
</variables>
Παράδειγμα output:
-----------------
<headers>
1. INTERPRETATION
1.1 Part A
1.2 Part B
</headers>
<variables>
Όνομα Συμβαλλομένου: text
Ημερομηνία Υπογραφής: date
</variables>
-----------------

ΠΡΟΣΟΧΗ: 
- Μην αναδιατάξεις, μην συμπτύξεις και μην τροποποιήσεις τους τίτλους/υπότιτλους.
- Μην προσθέσεις καμία εξτρά εισαγωγή, επεξήγηση ή σχολιασμό πέρα από το παραπάνω format.
- Αν δεν είσαι σίγουρος/η για κάτι, συμπεριέλαβέ το ως έχει.
- Παρέδωσε μόνο τις ετικέτες <headers> ... </headers> και <variables> ... </variables> ως τελικό αποτέλεσμα.
		`,
    prompt: `
			<contract_text>
				${contract}
			</contract_text>
			`,
  })
  return object
}

const ContractSectionSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string().describe('Title for the section'),
      section: z.string().describe('Extracted section of the contract'),
      description: z
        .string()
        .describe('A short and precise description about the section'),
    })
  ),
  fields: z.array(
    z
      .object({
        field_name: z.string().describe('Name of the field'),
        field_type: z
          .string()
          .describe('HTML input type of the field: Eg: text, date, file'),
      })
      .describe(
        'Extracted data fields that should be replaced with new data. Eg: Company Name, Client Name, Addresses, Dates'
      )
  ),
})

export type ContractSection = z.infer<typeof ContractSectionSchema>

let _vectorPool: InstanceType<typeof pg.Pool> | null = null
function getVectorPool() {
  if (!_vectorPool) {
    _vectorPool = new pg.Pool({
      host: process.env.VECTOR_DB_HOST || 'c-publisize-postgress.rcf5qaewuyzyua.postgres.cosmos.azure.com',
      port: Number(process.env.VECTOR_DB_PORT) || 5432,
      user: process.env.VECTOR_DB_USER || 'citus',
      password: process.env.VECTOR_DB_PASSWORD!,
      database: process.env.VECTOR_DB_NAME || 'citus',
      ssl: true,
      max: 5,
      idleTimeoutMillis: 30000,
    })
  }
  return _vectorPool
}

export const createContractVectorStore = async (contractId: string) => {
  const reusablePool = getVectorPool()

  const originalConfig = {
    pool: reusablePool,
    tableName: 'contract_files_embedding',
    collectionName: contractId,
    collectionTableName: 'contract_files_collection',
    columns: {
      idColumnName: 'id',
      vectorColumnName: 'embedding',
      contentColumnName: 'document',
      metadataColumnName: 'metadata',
    },
  }

  const embeddings = new OpenAIEmbeddings()
  const pgvectorStore = new PGVectorStore(embeddings, originalConfig)
  return pgvectorStore
}
