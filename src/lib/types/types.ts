export type Chat = {
  id: string
  userId: string
  title: string
  note: string | null
  createdAt: Date | null
}

export type CaseStudy = {
  id: string
  userId: string
  title: string
  note: string | null
  createdAt: Date | null
}
export type DocumentCreation = {
  id: string
  userId: string
  title: string
  note: string | null
  createdAt: Date | null
}

export type ContractComparisonChat = {
  id: string
  userId: string
  title: string
  note: string | null
  createdAt: Date | null
}

export type Contract = {
  id: string
  userId: string
  title: string
  note: string | null
  description?: string | null
  createdAt: Date | null
}

export type CaseStudyFile = {
  id: string
  case_study_id: string
  file_name: string
  file_path: string
  file_size: string
  file_type: string
  file_content: string
  file_blob: string
}

export type DocumentCreationFile = {
  id: string
  case_study_id: string
  file_name: string
  file_path: string
  file_size: string
  file_type: string
  file_content: string
  file_blob: string
}

export interface DocumentCreationMessage {
  id: string
  content: string
  role: string
  createdAt: Date | string
  document_creation_id: string
}

export type ContractComparisonFile = {
  id: string
  contractComparisonId: string
  vaultFileId: string
  file_name: string
  file_path: string
  file_size: string
  file_type: string
  file_content: string
  file_blob: string
}

export type ContractFile = {
  id: string
  contract_id: string
  file_name: string
  file_path: string
  file_size: string
  file_type: string
  file_content: string
}

export type ContractDraft = {
  role?: any
  id: string
  draft: string
  createdAt: Date
  contractId: string
}

export type ContractDataField = {
  id: string
  field_name: string
  field_type: string
  value?: string
}

export type ContractSection = {
  id: string
  title: string
  description?: string
  createdAt: Date
  contractId: string
}

export type PendingReference = {
  pdf_url?: string
  court?: string
  decision_number?: string
  decision_date?: string
  case_type?: string
  main_laws?: string
  key_articles?: string
  primary_issue?: string
  full_text?: string
  page_content?: string
}

export type Reference = PendingReference & {
  id: string
  chatId: string
  messageId: string
  createdAt: Date
}

export interface TempReference {
  chatId: string
  messageId: string
  refs: any[]
  status: 'pending' | 'processing' | 'complete'
  createdAt: Date
}

export type VaultFolderFiles = {
  id: string
  folderName: string
  isPrivate: boolean
  createdAt: Date
  userId: string
  vaultFiles: VaultFile[]
}
export interface OptimizationConfig {
  maxLawCharacters: number;
  maxCaseCharacters: number;
  rerankedK: number;
  searchParams: {
    knn_k: number;
    knn_num_candidates: number;
    rrf_rank_window_size: number;
    rrf_rank_constant: number;
  };
}

export interface DocumentMetrics {
  documentCount: number;
  totalCharacters: number;
  estimatedTokens: number;
}

export interface VaultFolder {
  id: string
  folderName: string
  userId: string
  organizationId?: string
  createdAt?: Date
  isPrivate: boolean
  isShared: boolean
}
export type VaultFile = {
  id: string
  fileName: string
  storageUrl: string
  createdAt: Date
  fileType: string
  fileSize: string
  chunkIds: string[]
  folderId: string
}

export type LibraryFolderFiles = {
  id: string
  folderName: string
  isPrivate: boolean
  createdAt: Date
  userId: string
  libraryFiles: LibraryFile[]
}

export interface LibraryFolder {
  id: string
  folderName: string
  userId: string
  organizationId?: string
  createdAt?: Date
  isPrivate: boolean
  isShared: boolean
}

export type LibraryFile = {
  id: string
  fileName: string
  storageUrl: string
  createdAt: Date
  fileType: string
  fileSize: string
  folderId: string
  chunkIds: string[]
}

// Enum types
export type AddonType = 'messages' | 'storage' // Assuming these are the values for addonTypeEnum
export type SubscriptionStatus =
  | 'active'
  | 'inactive'
  | 'canceled'
  | 'expired'
  | 'past_due'
  | 'trialing'
  | 'unpaid'
  | 'incomplete' // Assuming these are the values for subscriptionStatusEnum

// AddOn type
export type AddOn = {
  id: string
  name: string
  description: string | null
  type: AddonType
  stripePriceId: string
  price: number // in cents
  additionalMessageCount: number | null
  additionalFileUploadCount: number | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type AddOnPackages = AddOn & {
  icon: React.ReactElement
}

// Subscription type
export type Subscription = {
  id: string
  organisationId: string
  planId: string
  paymentInterval: string
  status: SubscriptionStatus
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean | null
  // stripeCustomerId: string;
  // stripeSubscriptionId: string | null;
  metadata: any
  createdAt: Date
  updatedAt: Date
}

// UserAddOn type (junction table)
export type UserAddOn = {
  id: string
  subscriptionId: string
  addOnId: string
  quantity: number
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// Usage type
export type Usage = {
  id: string
  subscriptionId: string
  periodStart: Date
  periodEnd: Date
  messagesSent: number
  pagesUploaded: number
  createdAt: Date
  updatedAt: Date
}

// UsageLog type
export type UsageLog = {
  id: string
  subscriptionId: string
  type: AddonType
  metadata: Record<string, any> | null
  createdAt: Date
}

// Payment type
export type Payment = {
  id: string
  subscriptionId: string
  amount: number // in cents
  currency: string
  stripePaymentId: string | null
  stripeInvoiceId: string | null
  stripeInvoiceUrl: string | null
  status: string
  metadata: Record<string, any> | null
  createdAt: Date
}

// Relationships types for easier data access

// Subscription with related plan
export type SubscriptionWithPlan = Subscription & {
  plan: {
    id: string
    name: string
    type: string
    monthlyPrice: number
    yearlyPrice: number
    monthlyMessageLimit: number
    monthlyFileUploadLimit: number
    features: Record<string, any> | null
    stripePriceIdMonthly: string
    stripePriceIdYearly: string
    createdAt: Date
    updatedAt: Date
  }
}

// Tool File types
export type ToolFileSource = 'library' | 'vault' | 'upload'
export type ToolName =
  | 'lawbot'
  | 'case_study'
  | 'contract_comparison'
  | 'contract'
  | 'document_creation'

export type ToolFile = {
  id: string
  toolName: ToolName
  fileSource: ToolFileSource
  chatId: string
  fileId: string
  createdAt: Date | null
  updatedAt: Date | null
}

// Subscription with add-ons
export type SubscriptionWithAddOns = Subscription & {
  addOns: (UserAddOn & {
    addOn: AddOn
  })[]
}

// Subscription with usage
export type SubscriptionWithUsage = Subscription & {
  usage: Usage[]
}

// Complete subscription data
export type CompleteSubscriptionData = Subscription & {
  plan: {
    id: string
    name: string
    type: string
    monthlyPrice: number
    yearlyPrice: number
    monthlyMessageLimit: number
    monthlyFileUploadLimit: number
    features: Record<string, any> | null
    stripePriceIdMonthly: string
    stripePriceIdYearly: string
    createdAt: Date
    updatedAt: Date
  }
  addOns: (UserAddOn & {
    addOn: AddOn
  })[]
  usage: Usage[]
  payments: Payment[]
  usageLogs: UsageLog[]
}

export type UsageLimitsWithCheck = {
  active_subscription: boolean
  subscriptionId: string
  messageLimit: {
    isReached: boolean
    used: number
    baseLimit: number
    addOnBonus: number
    totalLimit: number
    percentage: number
  }
  uploadLimit: {
    isReached: boolean
    used: number
    baseLimit: number
    addOnBonus: number
    totalLimit: number
    percentage: number
  }
}
