import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <SignUp
      appearance={{
        elements: {
          logoImage: 'w-[250px]',
          rootBox: 'mx-auto mt-6',
        },
      }}
    />
  );
}
