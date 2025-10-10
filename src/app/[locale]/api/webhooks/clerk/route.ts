import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { users } from '@/db/schema';
import db from '@/db/drizzle';

export async function POST(req: Request) {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    
    const headerPayload = headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");
  
    if (!WEBHOOK_SECRET || !svix_id || !svix_timestamp || !svix_signature) {
      return new Response('Missing webhook secret or headers', { status: 400 });
    }
  
    const payload = await req.json();
    const webhook = new Webhook(WEBHOOK_SECRET);
  
    try {
      const evt = webhook.verify(
        JSON.stringify(payload),
        {
          "svix-id": svix_id,
          "svix-timestamp": svix_timestamp,
          "svix-signature": svix_signature,
        }
      ) as WebhookEvent;
  
      if (evt.type === 'user.created') {
        const userData = evt.data;
        
        // Insert with explicit type checking
        await db.insert(users).values({
          id: userData.id,
          firstName: userData.first_name ?? '',
          lastName: userData.last_name ?? '',
          email: userData.email_addresses[0].email_address,
        });
      }
  
      return new Response('Webhook processed successfully', { status: 200 });
    } catch (err) {
      console.error('Error processing webhook:', err);
      return new Response('Webhook verification failed', { status: 400 });
    }
  }