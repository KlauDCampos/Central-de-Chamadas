import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY || '',
  triagemProvider: (process.env.TRIAGEM_PROVIDER || 'heuristic') as 'heuristic' | 'huggingface',
};
