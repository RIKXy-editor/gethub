import { Router } from 'express';

export const authRouter = Router();

const DISCORD_API = 'https://discord.com/api/v10';
const REDIRECT_URI = () => {
  const domain = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
  return `https://${domain}/auth/callback`;
};

authRouter.get('/login', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirect = encodeURIComponent(REDIRECT_URI());
  const scope = encodeURIComponent('identify guilds');
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=${scope}`);
});

authRouter.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/');

  try {
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI()
      })
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) return res.redirect('/?error=auth_failed');

    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const user = await userRes.json();

    const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const guilds = await guildsRes.json();

    const guildId = process.env.DISCORD_GUILD_ID;
    const targetGuild = guilds.find(g => g.id === guildId);

    if (!targetGuild) {
      return res.redirect('/?error=not_in_guild');
    }

    const isOwner = targetGuild.owner;
    const perms = BigInt(targetGuild.permissions);
    const isAdmin = isOwner || (perms & BigInt(0x8)) === BigInt(0x8) || (perms & BigInt(0x20)) === BigInt(0x20);

    if (!isAdmin) {
      return res.redirect('/?error=no_permission');
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
      isAdmin: true,
      guildId
    };

    res.redirect('/dashboard');
  } catch (err) {
    console.error('[AUTH] OAuth error:', err);
    res.redirect('/?error=auth_error');
  }
});

authRouter.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

authRouter.get('/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json(req.session.user);
});
