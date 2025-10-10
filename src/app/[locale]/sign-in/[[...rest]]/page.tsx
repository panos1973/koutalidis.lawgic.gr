import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <SignIn
      appearance={{
        elements: {
          logoImage: 'w-[250px]',
          rootBox: 'mx-auto mt-8',
        },
      }}
    />
  );
}
