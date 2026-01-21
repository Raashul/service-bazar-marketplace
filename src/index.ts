import express from 'express';
import cors from 'cors';
import { connectDB } from './config/database';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import messageRoutes from './routes/messages';
import imageRoutes from './routes/images';
import locationRoutes from './routes/locations';
import preferencesRoutes from './routes/preferences';
import matchesRoutes from './routes/matches';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/matches', matchesRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();