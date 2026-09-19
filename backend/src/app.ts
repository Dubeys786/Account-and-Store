import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env';
import healthRoutes from './modules/health/health.routes';
import authRoutes from './modules/auth/auth.routes';
import storeRoutes from './modules/store/store.routes';
import accountsRoutes from './modules/accounts/accounts.routes';
import { errorHandler } from './middleware/error.middleware';

export const app = express();

// Security middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (
        env.CORS_ORIGIN.indexOf(origin) !== -1 ||
        env.NODE_ENV === 'development'
      ) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Not allowed by origin'));
    },
    credentials: true,
  })
);

// Logging middleware
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/store', storeRoutes);
app.use('/api/v1/accounts', accountsRoutes);

// Root fallback
app.get('/', (_req, res) => {
  res.json({
    name: 'PROZEN Store & Accounts Management API',
    version: '1.0.0',
    status: 'online',
    documentation: '/api/v1/health',
  });
});

// Centralized Error Handling
app.use(errorHandler);

export default app;
