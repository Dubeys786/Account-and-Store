import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env';
import healthRoutes from './modules/health/health.routes';
import authRoutes from './modules/auth/auth.routes';
import storeRoutes from './modules/store/store.routes';
import accountsRoutes from './modules/accounts/accounts.routes';
import notificationRoutes from './modules/notification/notification.routes';
import { errorHandler } from './middleware/error.middleware';

export const app = express();

// Pretty-print JSON responses in development for readability
if (env.NODE_ENV === 'development') {
  app.set('json spaces', 2);
}

// Security middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      const allowedOrigins = env.CORS_ORIGIN;
      if (
        allowedOrigins.includes(origin) ||
        env.NODE_ENV === 'development' ||
        origin.endsWith('.netlify.app') ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Not allowed by origin'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-store-id', 'X-Requested-With', 'Accept'],
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

// Canonical API Routes (v1)
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/store', storeRoutes);
app.use('/api/v1/accounts', accountsRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Unversioned API Route Aliases (/api/...) for backward compatibility and flexible deployment
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/notifications', notificationRoutes);

// Route alias for /api/reports/email
app.use('/api/reports', (req, res, next) => {
  req.url = `/reports${req.url}`;
  accountsRoutes(req, res, next);
});

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
