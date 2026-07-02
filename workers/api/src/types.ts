export type Env = {
  DB: D1Database;
  ADMIN_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
};

export type AuthedReviewer = {
  id: string;
  name: string;
  email: string;
};
