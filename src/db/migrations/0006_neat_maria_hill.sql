ALTER TABLE "library_folders" DROP CONSTRAINT "library_folders_parentId_library_folders_id_fk";
--> statement-breakpoint
ALTER TABLE "vault_folders" DROP CONSTRAINT "vault_folders_parentId_vault_folders_id_fk";
--> statement-breakpoint
ALTER TABLE "library_folders" DROP COLUMN IF EXISTS "parentId";--> statement-breakpoint
ALTER TABLE "vault_folders" DROP COLUMN IF EXISTS "parentId";