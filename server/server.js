import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'expensepro-api' });
});

app.use('/api', (_req, res) => {
  res.status(410).json({
    success: false,
    message: 'The legacy API has been retired. Authenticate with Supabase and use the database policies.'
  });
});

if (process.env.VERCEL !== '1') {
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => console.log(`ExpensePro API listening on ${port}`));
}

export default app;
