import { Router } from 'express';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { password } = req.body;
  const dashPassword = process.env.DASHBOARD_PASSWORD;

  if (!dashPassword) {
    console.error('[AUTH] DASHBOARD_PASSWORD not set');
    return res.redirect('/?error=not_configured');
  }

  if (password !== dashPassword) {
    return res.redirect('/?error=wrong_password');
  }

  req.session.user = {
    isAdmin: true,
    guildId: process.env.DISCORD_GUILD_ID
  };

  req.session.save((err) => {
    if (err) {
      console.error('[AUTH] Session save error:', err);
      return res.redirect('/?error=session_error');
    }
    res.redirect('/dashboard');
  });
});

authRouter.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

authRouter.get('/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json(req.session.user);
});
