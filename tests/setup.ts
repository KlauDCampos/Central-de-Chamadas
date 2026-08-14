// Garante que os testes usem um banco SQLite isolado, e um segredo JWT fixo.
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-secret';
process.env.TRIAGEM_PROVIDER = 'heuristic';
