export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      userType?: string;
      defaultLanguage?: 'en' | 'el';
    };
  }
}
