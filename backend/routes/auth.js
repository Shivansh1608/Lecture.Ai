import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();
const pub = (u) => ({ id: u._id, name: u.name, email: u.email, avatar: u.avatar });

router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6)
      return res.status(400).json({ message: 'Name, email and a 6+ character password are required' });
    if (await User.findOne({ email })) return res.status(409).json({ message: 'Email already registered' });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: signToken(user._id), user: pub(user) });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user?.password || !(await bcrypt.compare(password || '', user.password)))
      return res.status(401).json({ message: 'Wrong email or password' });
    res.json({ token: signToken(user._id), user: pub(user) });
  } catch (e) { next(e); }
});

router.post('/google', async (req, res, next) => {
  try {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    let user = await User.findOne({ email: p.email });
    if (!user) user = await User.create({ name: p.name, email: p.email, googleId: p.sub, avatar: p.picture });
    res.json({ token: signToken(user._id), user: pub(user) });
  } catch (e) { e.status = 401; e.message = 'Google login failed'; next(e); }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user: pub(user) });
});

export default router;
