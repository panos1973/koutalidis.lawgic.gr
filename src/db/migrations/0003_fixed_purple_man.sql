ALTER TABLE "library_folders" ADD COLUMN "parentId" uuid;--> statement-breakpoint
ALTER TABLE "vault_folders" ADD COLUMN "parentId" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_folders" ADD CONSTRAINT "library_folders_parentId_library_folders_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."library_folders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vault_folders" ADD CONSTRAINT "vault_folders_parentId_vault_folders_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."vault_folders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
