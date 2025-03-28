import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import connectdb from './config/mongodb.js';
import { trackAPIStats } from './middleware/statsMiddleware.js';
import propertyrouter from './routes/ProductRouter.js';
import userrouter from './routes/UserRoute.js';
import formrouter from './routes/formrouter.js';
import newsrouter from './routes/newsRoute.js';
import appointmentRouter from './routes/appointmentRoute.js';
import adminRouter from './routes/adminRoute.js';
import propertyRoutes from './routes/propertyRoutes.js';
import adminProperties from './routes/adminProperties.js';

import path from "path";
import { fileURLToPath } from "url";

// Manually define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


dotenv.config();

const app = express();

// MIME type middleware - Add this near the top before other middleware
// This ensures JavaScript files are served with the correct MIME type
app.use((req, res, next) => {
  if (req.path.endsWith('.js')) {
    res.type('application/javascript');
  } else if (req.path.endsWith('.mjs')) {
    res.type('application/javascript');
  }
  next();
});

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// Security middlewares
app.use(limiter);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: [
          "'self'",
          "data:",
          "https://ik.imagekit.io",  // ✅ ImageKit
          "https://images.unsplash.com"  // ✅ Unsplash
        ],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "https://ik.imagekit.io", "https://images.unsplash.com"],
      },
    },
  })
);



app.use(compression());

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(trackAPIStats);


// CORS Configuration
// app.use(cors({
//   origin: [
//     'http://localhost:4000',
//     'http://localhost:5174',
//     'http://localhost:5173',
//     'https://buildestate.vercel.app',
//     'https://real-estate-website-admin.onrender.com',
//     'https://real-estate-website-backend-zfu7.onrender.com',
//   ],
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'], // Added HEAD
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
// }));

// Database connection
connectdb().then(() => {
  console.log('Database connected successfully');
}).catch(err => {
  console.error('Database connection error:', err);
});


// API Routes
app.use('/api/products', propertyrouter);
app.use('/api/users', userrouter);
app.use('/api/forms', formrouter);
app.use('/api/news', newsrouter);
app.use('/api/appointments', appointmentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/properties', adminProperties);
app.use('/api', propertyRoutes);

// Status check endpoint
app.get('/status', (req, res) => {
  res.status(200).json({ status: 'OK', time: new Date().toISOString() });
});

// Root endpoint - health check HTML
// app.get("/", (req, res) => {
//   res.send(`
//     <!DOCTYPE html>
//     <html lang="en">
//       <head>
//         <meta charset="UTF-8">
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//         <title>BuildEstate API Status</title>
//         <style>
//           body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
//           .container { background: #f9fafb; border-radius: 8px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
//           h1 { color: #2563eb; }
//           .status { color: #16a34a; font-weight: bold; }
//           .info { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
//           .footer { margin-top: 30px; font-size: 0.9rem; color: #6b7280; text-align: center; }
//         </style>
//       </head>
//       <body>
//         <div class="container">
//           <h1>BuildEstate API</h1>
//           <p>Status: <span class="status">Online</span></p>
//           <p>Server Time: ${new Date().toLocaleString()}</p>
          
//           <div class="info">
//             <p>The BuildEstate API is running properly. This backend serves property listings, user authentication, 
//             and AI analysis features for the BuildEstate property platform.</p>
//           </div>
          
//           <div class="footer">
//             <p>© ${new Date().getFullYear()} BuildEstate. All rights reserved.</p>
//           </div>
//         </div>
//       </body>
//     </html>
//   `);
// });

// Catch-all handler to serve frontend's index.html for React/SPA routing
const NODE_ENV = "production";


if (NODE_ENV === "production") {
  // Serve User Frontend with proper MIME types
  app.use(express.static(path.join(__dirname, "dist"), {
    setHeaders: (res, path) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (path.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));
  
  // app.use(express.static(path.join(__dirname, "dist_admin")));
  
  // Serve Admin Frontend
  // app.use("/admin", express.static(path.join(__dirname, "dist_admin")));

  // // Catch-all for Admin SPA routing
  // app.get("/admin/*", (req, res) =>
  //     res.sendFile(path.resolve(__dirname, "dist_admin", "index.html"))
  // );

  // Handle specific JS files that might be causing issues
  app.get('/index-*.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'dist', req.path.substring(1)));
  });

  // Catch-all for User SPA routing - Must be last
  app.get("*", (req, res) =>
      res.sendFile(path.resolve(__dirname, "dist", "index.html"))
  );

} else {
  app.get("/", (req, res) => res.send("Please set to production"));
}

// Error handling middleware - Make sure this is after routes
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    statusCode,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err);
  process.exit(1);
});

const port = process.env.PORT || 4000;

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;