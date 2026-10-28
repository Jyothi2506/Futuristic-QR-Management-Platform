import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// In-memory persistent database store
export interface DynamicQRRecord {
  id: string;
  shortCode: string;
  name: string;
  destinationUrl: string;
  type: string;
  status: 'active' | 'archived' | 'expired';
  protection: 'none' | 'pin';
  pin?: string;
  expiresAt?: string;
  totalScans: number;
  createdAt: string;
  dotStyle: string;
  eyeStyle: string;
  colorPreset: string;
  centerIcon: string;
}

export interface IngressEvent {
  id: string;
  timestamp: string;
  matrixName: string;
  deviceOS: string;
  edgeRegion: string;
  latency: string;
  destination: string;
  ip: string;
}

// Initial seed data matching the UI showcase
const qrRecords: DynamicQRRecord[] = [
  {
    id: 'qr-1',
    shortCode: 'launch-25',
    name: 'Global Launch 2025',
    destinationUrl: 'https://yourbrand.com/launch',
    type: 'url',
    status: 'active',
    protection: 'none',
    totalScans: 42910,
    createdAt: '2025-05-01T10:00:00Z',
    dotStyle: 'rounded',
    eyeStyle: 'rounded',
    colorPreset: 'cyan-violet',
    centerIcon: 'qr_code',
  },
  {
    id: 'qr-2',
    shortCode: 'penthouse',
    name: 'VIP Penthouse Menu',
    destinationUrl: 'https://luxurygin.co/menu',
    type: 'url',
    status: 'active',
    protection: 'pin',
    pin: '8888',
    totalScans: 18340,
    createdAt: '2025-05-10T14:30:00Z',
    dotStyle: 'smooth',
    eyeStyle: 'orbit',
    colorPreset: 'electric-blue',
    centerIcon: 'lock',
  },
  {
    id: 'qr-3',
    shortCode: 'q1-conf',
    name: 'Q1 Hardware Conference',
    destinationUrl: 'https://developer.org/slides-archive',
    type: 'url',
    status: 'expired',
    protection: 'none',
    totalScans: 67240,
    createdAt: '2025-03-15T09:00:00Z',
    dotStyle: 'square',
    eyeStyle: 'square',
    colorPreset: 'amber-cyber',
    centerIcon: 'none',
  },
];

const liveIngressEvents: IngressEvent[] = [
  {
    id: 'ev-1',
    timestamp: '10:42:01.892',
    matrixName: 'Tokyo Flagship Door',
    deviceOS: 'iPhone 16 Pro (iOS 18.2)',
    edgeRegion: 'NRT-Edge-01',
    latency: '7.2ms',
    destination: 'https://yourbrand.com/launch',
    ip: '133.242.18.9',
  },
  {
    id: 'ev-2',
    timestamp: '10:41:58.120',
    matrixName: 'VIP Invitation Card #088',
    deviceOS: 'Samsung Galaxy S24 (Android 14)',
    edgeRegion: 'SFO-Edge-09',
    latency: '9.4ms',
    destination: 'https://luxurygin.co/verify',
    ip: '172.56.21.4',
  },
  {
    id: 'ev-3',
    timestamp: '10:41:52.415',
    matrixName: 'Lounge Wi-Fi Node',
    deviceOS: 'iPad Pro (iPadOS 18)',
    edgeRegion: 'LHR-Edge-03',
    latency: '6.1ms',
    destination: 'WIFI:S:Liquid_Lounge;',
    ip: '82.165.197.1',
  },
];

// Smart Hosted Pages Store for Non-URL QR data
interface SharedDataRecord {
  id: string;
  type: string;
  content: string;
  createdAt: string;
}
const sharedDataRecords = new Map<string, SharedDataRecord>();
// Seed a sample shared page
sharedDataRecords.set('sample-wifi', {
  id: 'sample-wifi',
  type: 'wifi',
  content: 'WIFI:S:Liquid_Lounge_5G;T:WPA;P:QuantumGlass99;;',
  createdAt: new Date().toISOString(),
});

// Helper to log a scan
function recordScan(record: DynamicQRRecord, req: express.Request) {
  record.totalScans += 1;
  const userAgent = req.headers['user-agent'] || 'Unknown Device';
  let deviceOS = 'Desktop (macOS / Windows)';
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    deviceOS = 'Apple iOS Device';
  } else if (/Android/i.test(userAgent)) {
    deviceOS = 'Android Device';
  }

  const regions = ['NRT-Edge-01 (Tokyo)', 'SFO-Edge-09 (US West)', 'LHR-Edge-03 (London)', 'FRA-Edge-02 (Frankfurt)', 'SIN-Edge-05 (Singapore)'];
  const randomRegion = regions[Math.floor(Math.random() * regions.length)];
  const latency = (Math.random() * 5 + 4).toFixed(1) + 'ms';
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

  const newEvent: IngressEvent = {
    id: 'ev-' + Date.now(),
    timestamp: timeStr,
    matrixName: record.name,
    deviceOS,
    edgeRegion: randomRegion.split(' ')[0],
    latency,
    destination: record.destinationUrl,
    ip: req.ip || '127.0.0.1',
  };

  liveIngressEvents.unshift(newEvent);
  if (liveIngressEvents.length > 25) {
    liveIngressEvents.pop();
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Static files uploaded
  app.use('/uploads', express.static(uploadDir));

  // ==========================================
  // DYNAMIC SHORT REDIRECT ROUTE: /sc/:shortCode
  // ==========================================
  app.get('/sc/:shortCode', (req, res) => {
    const { shortCode } = req.params;
    const record = qrRecords.find(
      (r) => r.shortCode.toLowerCase() === shortCode.toLowerCase()
    );

    if (!record) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html class="dark">
        <head>
          <meta charset="utf-8">
          <title>Dynamic QR Not Found - QR TO LINK</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-[#07111F] text-[#d9e3f7] flex items-center justify-center min-h-screen p-4 font-sans">
          <div class="max-w-md w-full p-8 rounded-3xl bg-[#0B1730]/90 border border-white/10 shadow-2xl text-center flex flex-col items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center text-2xl font-bold">!</div>
            <h1 class="text-2xl font-bold text-white">Dynamic Link Not Found</h1>
            <p class="text-sm text-slate-400">The shortcode <code class="text-cyan-400 font-mono">/sc/${shortCode}</code> does not correspond to an active QR route.</p>
            <a href="/" class="mt-4 px-6 py-2.5 rounded-full bg-[#2563FF] text-white text-sm font-semibold hover:opacity-90">Return to QR TO LINK</a>
          </div>
        </body>
        </html>
      `);
    }

    if (record.status === 'expired') {
      return res.status(410).send(`
        <!DOCTYPE html>
        <html class="dark">
        <head>
          <meta charset="utf-8">
          <title>Dynamic QR Expired - QR TO LINK</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-[#07111F] text-[#d9e3f7] flex items-center justify-center min-h-screen p-4 font-sans">
          <div class="max-w-md w-full p-8 rounded-3xl bg-[#0B1730]/90 border border-white/10 shadow-2xl text-center flex flex-col items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl font-bold">⏱</div>
            <h1 class="text-2xl font-bold text-white">Campaign Expired</h1>
            <p class="text-sm text-slate-400">This dynamic QR link (<span class="text-amber-400 font-semibold">${record.name}</span>) has reached its scheduled expiration window.</p>
            <a href="/" class="mt-4 px-6 py-2.5 rounded-full bg-[#2563FF] text-white text-sm font-semibold hover:opacity-90">Return to QR TO LINK</a>
          </div>
        </body>
        </html>
      `);
    }

    // Check PIN protection
    if (record.protection === 'pin' && record.pin) {
      return res.send(`
        <!DOCTYPE html>
        <html class="dark">
        <head>
          <meta charset="utf-8">
          <title>Security Vault - QR TO LINK</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-[#07111F] text-[#d9e3f7] flex items-center justify-center min-h-screen p-4 font-sans">
          <div class="max-w-md w-full p-8 rounded-3xl bg-[#0B1730]/90 border border-white/10 shadow-2xl text-center flex flex-col items-center gap-4 backdrop-blur-xl">
            <div class="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-2xl">🔒</div>
            <h1 class="text-2xl font-bold text-white">Protected Dynamic QR</h1>
            <p class="text-sm text-slate-400">Destination for <strong class="text-white">${record.name}</strong> requires an authorization passcode.</p>
            <form action="/sc/${shortCode}/unlock" method="POST" class="w-full flex flex-col gap-3 mt-2">
              <input type="password" name="pin" placeholder="Enter PIN code" required class="w-full bg-[#07111F] border border-white/10 rounded-2xl px-4 py-3 text-center text-lg text-white font-mono tracking-widest focus:outline-none focus:border-cyan-400" />
              <button type="submit" class="w-full py-3 rounded-2xl bg-gradient-to-r from-[#2563FF] to-[#22D3EE] text-white font-semibold shadow-lg hover:opacity-95">Access Destination</button>
            </form>
          </div>
        </body>
        </html>
      `);
    }

    // Active & unprotected: Record scan and redirect
    recordScan(record, req);
    res.redirect(302, record.destinationUrl);
  });

  // PIN Unlock POST
  app.post('/sc/:shortCode/unlock', (req, res) => {
    const { shortCode } = req.params;
    const { pin } = req.body;
    const record = qrRecords.find(
      (r) => r.shortCode.toLowerCase() === shortCode.toLowerCase()
    );

    if (!record) {
      return res.status(404).send('Not Found');
    }

    if (record.pin && record.pin === pin) {
      recordScan(record, req);
      return res.redirect(302, record.destinationUrl);
    } else {
      return res.status(401).send(`
        <!DOCTYPE html>
        <html class="dark">
        <head>
          <meta charset="utf-8">
          <title>Access Denied - QR TO LINK</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-[#07111F] text-[#d9e3f7] flex items-center justify-center min-h-screen p-4 font-sans">
          <div class="max-w-md w-full p-8 rounded-3xl bg-[#0B1730]/90 border border-white/10 shadow-2xl text-center flex flex-col items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center text-2xl font-bold">✕</div>
            <h1 class="text-2xl font-bold text-white">Incorrect Passcode</h1>
            <p class="text-sm text-slate-400">The passcode entered does not match the vault credentials.</p>
            <a href="/sc/${shortCode}" class="mt-4 px-6 py-2.5 rounded-full bg-[#2563FF] text-white text-sm font-semibold hover:opacity-90">Try Again</a>
          </div>
        </body>
        </html>
      `);
    }
  });

  // ==========================================
  // SMART HOSTED PAGES: /view/:shareId
  // ==========================================
  app.get('/view/:shareId', (req, res) => {
    const { shareId } = req.params;
    const item = sharedDataRecords.get(shareId);

    if (!item) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html class="dark">
        <head>
          <meta charset="utf-8">
          <title>Information Not Found - QR TO LINK</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-[#07111F] text-[#d9e3f7] flex items-center justify-center min-h-screen p-4 font-sans">
          <div class="max-w-md w-full p-8 rounded-3xl bg-[#0B1730]/90 border border-white/10 shadow-2xl text-center flex flex-col items-center gap-4">
            <h1 class="text-xl font-bold text-white">Record Not Found</h1>
            <p class="text-xs text-slate-400">This hosted QR link may have expired.</p>
            <a href="/" class="px-5 py-2.5 rounded-full bg-[#2563FF] text-white text-xs font-semibold">Open QR TO LINK</a>
          </div>
        </body>
        </html>
      `);
    }

    res.send(`
      <!DOCTYPE html>
      <html class="dark">
      <head>
        <meta charset="utf-8">
        <title>Original QR Information - QR TO LINK</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Sora:wght@600;700&family=Material+Symbols+Outlined&display=swap" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { font-family: 'Plus Jakarta Sans', sans-serif; }
          h1, h2, h3 { font-family: 'Sora', sans-serif; }
        </style>
      </head>
      <body class="bg-[#07111F] text-[#d9e3f7] min-h-screen flex flex-col items-center justify-center p-4 relative overflow-x-hidden selection:bg-[#22D3EE] selection:text-[#07111F]">
        <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div class="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-[#22D3EE]/10 blur-[130px]"></div>
          <div class="absolute -right-40 top-1/4 h-[600px] w-[600px] rounded-full bg-[#7C3AED]/12 blur-[150px]"></div>
        </div>

        <div class="relative z-10 w-full max-w-lg rounded-[36px] bg-[#0B1730]/90 border border-white/15 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-2xl p-6 sm:p-8 flex flex-col gap-6">
          <div class="flex items-center justify-between border-b border-white/10 pb-4">
            <div class="flex items-center gap-2.5">
              <div class="h-9 w-9 rounded-xl bg-gradient-to-br from-[#2563FF] to-[#22D3EE] flex items-center justify-center shadow-md">
                <span class="material-symbols-outlined text-[#00287d] font-bold text-[20px]">qr_code_2</span>
              </div>
              <span class="font-bold text-white text-base">QR<span class="text-[#22D3EE]">TO</span>LINK</span>
            </div>
            <span class="px-3 py-1 rounded-full bg-[#22D3EE]/15 text-[#22D3EE] text-[11px] font-bold uppercase tracking-wider font-mono">
              ${item.type}
            </span>
          </div>

          <div>
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Decoded Matrix Payload
            </span>
            <h1 class="text-xl sm:text-2xl font-bold text-white">Original QR Information</h1>
          </div>

          <div class="p-4 rounded-2xl bg-[#07111F] border border-white/5 shadow-inner">
            <p class="text-xs sm:text-sm text-slate-200 font-mono break-all leading-relaxed whitespace-pre-wrap">${item.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            <button onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(item.content)}')); alert('Copied content to clipboard!');" class="py-2.5 rounded-xl bg-[#2563FF] text-white text-xs font-bold uppercase flex items-center justify-center gap-1 shadow-md hover:opacity-95">
              <span class="material-symbols-outlined text-[15px]">content_copy</span>
              <span>Copy</span>
            </button>
            <button onclick="if(navigator.share){navigator.share({title:'QR TO LINK Payload', text: window.location.href});}else{navigator.clipboard.writeText(window.location.href); alert('Share link copied!');}" class="py-2.5 rounded-xl bg-[#121C2A] text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1 border border-white/5">
              <span class="material-symbols-outlined text-[15px]">share</span>
              <span>Share</span>
            </button>
            <a href="/" class="py-2.5 rounded-xl bg-[#121C2A] text-[#22D3EE] hover:text-white text-xs font-semibold flex items-center justify-center gap-1 border border-[#22D3EE]/30">
              <span class="material-symbols-outlined text-[15px]">add</span>
              <span>Create QR</span>
            </a>
            <a href="/" class="py-2.5 rounded-xl bg-[#121C2A] text-slate-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1 border border-white/5">
              <span class="material-symbols-outlined text-[15px]">home</span>
              <span>Home</span>
            </a>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  app.post('/api/qr/create-link', (req, res) => {
    const { type = 'text', content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }
    const id = 'share-' + Math.random().toString(36).substring(2, 9);
    sharedDataRecords.set(id, {
      id,
      type,
      content,
      createdAt: new Date().toISOString(),
    });

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const shareUrl = `${protocol}://${host}/view/${id}`;

    res.json({ success: true, id, shareUrl });
  });

  // ==========================================
  // API: DYNAMIC QR FLEET MANAGEMENT
  // ==========================================
  app.get('/api/qr', (_req, res) => {
    res.json({ success: true, data: qrRecords });
  });

  app.post('/api/qr', (req, res) => {
    const {
      name,
      destinationUrl,
      type = 'url',
      status = 'active',
      protection = 'none',
      pin,
      dotStyle = 'rounded',
      eyeStyle = 'rounded',
      colorPreset = 'cyan-violet',
      centerIcon = 'qr_code',
      customShortCode,
    } = req.body;

    const shortCode =
      customShortCode?.trim() ||
      'qr-' + Math.random().toString(36).substring(2, 8);

    // Check unique shortcode
    const existing = qrRecords.find(
      (r) => r.shortCode.toLowerCase() === shortCode.toLowerCase()
    );
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Shortcode already reserved in fleet registry.',
      });
    }

    const newRecord: DynamicQRRecord = {
      id: 'qr-' + Date.now(),
      shortCode,
      name: name || 'Untitled Dynamic Matrix',
      destinationUrl: destinationUrl || 'https://yourbrand.com/launch',
      type,
      status,
      protection,
      pin,
      totalScans: 0,
      createdAt: new Date().toISOString(),
      dotStyle,
      eyeStyle,
      colorPreset,
      centerIcon,
    };

    qrRecords.unshift(newRecord);
    res.json({ success: true, data: newRecord });
  });

  app.patch('/api/qr/:id', (req, res) => {
    const { id } = req.params;
    const record = qrRecords.find((r) => r.id === id || r.shortCode === id);

    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    if (req.body.destinationUrl !== undefined) {
      record.destinationUrl = req.body.destinationUrl;
    }
    if (req.body.name !== undefined) {
      record.name = req.body.name;
    }
    if (req.body.status !== undefined) {
      record.status = req.body.status;
    }
    if (req.body.protection !== undefined) {
      record.protection = req.body.protection;
    }
    if (req.body.pin !== undefined) {
      record.pin = req.body.pin;
    }

    res.json({ success: true, data: record });
  });

  app.delete('/api/qr/:id', (req, res) => {
    const { id } = req.params;
    const index = qrRecords.findIndex((r) => r.id === id || r.shortCode === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    qrRecords.splice(index, 1);
    res.json({ success: true, message: 'Deleted successfully' });
  });

  // ==========================================
  // API: ANALYTICS & TELEMETRY
  // ==========================================
  app.get('/api/analytics', (_req, res) => {
    const totalScans = qrRecords.reduce((acc, curr) => acc + curr.totalScans, 0);
    res.json({
      success: true,
      data: {
        totalScans,
        uniqueDevices: Math.round(totalScans * 0.74),
        peakVelocity: '3,410/hr',
        activeNodes: 48,
        trafficTrend: [
          { day: 'Day 01', scans: 1420 },
          { day: 'Day 05', scans: 1980 },
          { day: 'Day 10', scans: 2450 },
          { day: 'Day 15', scans: 2210 },
          { day: 'Day 20', scans: 3890 },
          { day: 'Day 25', scans: 4320 },
          { day: 'Day 30', scans: 5890 },
        ],
        deviceDistribution: {
          ios: 64,
          android: 31,
          desktop: 5,
        },
        metroClusters: [
          { city: 'Tokyo, JP', count: '42,910' },
          { city: 'San Francisco, US', count: '31,440' },
          { city: 'London, UK', count: '22,100' },
          { city: 'Frankfurt, DE', count: '17,890' },
        ],
        liveIngressEvents,
      },
    });
  });

  // ==========================================
  // API: IMAGE UPLOAD (For IMAGE -> QR)
  // ==========================================
  app.post('/api/upload', (req, res) => {
    try {
      const { dataUrl, filename = 'uploaded-asset.png' } = req.body;
      if (!dataUrl || !dataUrl.includes('base64,')) {
        return res
          .status(400)
          .json({ success: false, error: 'Valid base64 dataUrl required.' });
      }

      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid data URL format.' });
      }

      const buffer = Buffer.from(matches[2], 'base64');
      const ext = filename.split('.').pop() || 'png';
      const safeName = `qr-asset-${Date.now()}.${ext}`;
      const filePath = path.join(uploadDir, safeName);

      fs.writeFileSync(filePath, buffer);

      const host = req.get('host') || 'localhost:3000';
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const publicUrl = `${protocol}://${host}/uploads/${safeName}`;

      res.json({
        success: true,
        url: publicUrl,
        filename: safeName,
        size: buffer.length,
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // API: AI QR SYNTHESIS (Gemini 3.8 Flash via @google/genai)
  // ==========================================
  app.post('/api/ai/generate', async (req, res) => {
    const { prompt, style = 'Liquid Glass', contrastWeight = 85 } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      // Fallback generator if API key not populated
      return res.json({
        success: true,
        source: 'creative-engine',
        data: {
          enhancedPrompt: `${prompt} | Style: ${style} with ${contrastWeight}% optical contrast compliance`,
          suggestedPalette: style.toLowerCase().includes('neon')
            ? 'cyan-violet'
            : style.toLowerCase().includes('gold')
            ? 'amber-cyber'
            : 'electric-blue',
          recommendedDotStyle: 'rounded',
          recommendedEyeStyle: 'orbit',
          artDescription: `A luminous, high-precision aesthetic rendering featuring fluid caustics, soft specular glass highlights, and vibrant neon refraction engineered to preserve QR ISO/IEC 18004 readability.`,
          scanabilityScore: 98.6,
        },
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are an AI QR optical engineering and generative art specialist.
The user wants to generate an artistic machine-readable QR code.
User Prompt: "${prompt}"
Artistic Paradigm: "${style}"
Contrast Scanability Weight: "${contrastWeight}%"

Respond with ONLY valid JSON with keys:
- "enhancedPrompt": expanded rich prompt for stable optical diffusion
- "suggestedPalette": one of ["cyan-violet", "electric-blue", "pure-white", "amber-cyber"]
- "recommendedDotStyle": one of ["rounded", "dots", "smooth", "diamond", "fluid", "square"]
- "recommendedEyeStyle": one of ["orbit", "rounded", "square"]
- "artDescription": brief 1-sentence poetic description of the synthesized liquid glass visual
- "scanabilityScore": estimated number between 96.0 and 99.8`,
      });

      let text = response.text || '';
      // Extract json block if wrapped in markdown
      if (text.includes('```json')) {
        text = text.split('```json')[1].split('```')[0].trim();
      } else if (text.includes('```')) {
        text = text.split('```')[1].split('```')[0].trim();
      }

      const parsed = JSON.parse(text);
      res.json({ success: true, source: 'gemini-3.8-flash', data: parsed });
    } catch (err: any) {
      console.warn('Gemini API call failed, falling back to local synthesis engine:', err.message);
      res.json({
        success: true,
        source: 'synthesis-fallback',
        data: {
          enhancedPrompt: `${prompt} (Liquid aesthetic optimized for ${contrastWeight}% scan parity)`,
          suggestedPalette: 'cyan-violet',
          recommendedDotStyle: 'rounded',
          recommendedEyeStyle: 'orbit',
          artDescription: `Atmospheric liquid glass composition with vibrant cyan refraction and high-contrast Reed-Solomon anchor protection.`,
          scanabilityScore: 98.4,
        },
      });
    }
  });

  // ==========================================
  // API: PROGRAMMATIC DEVELOPER QR GENERATION
  // ==========================================
  app.get('/api/qr/generate', async (req, res) => {
    try {
      const payload = (req.query.payload as string) || (req.query.url as string) || 'https://qr.link';
      const format = (req.query.format as string) || 'svg';
      const color1 = (req.query.color1 as string) || '#22D3EE';
      const color2 = (req.query.color2 as string) || '#7C3AED';

      if (format.toLowerCase() === 'svg') {
        const QRCode = (await import('qrcode')).default;
        const qr = QRCode.create(payload, { errorCorrectionLevel: 'H' });
        const size = qr.modules.size;
        let rects = '';
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (qr.modules.get(r, c)) {
              rects += `<rect x="${c}" y="${r}" width="0.88" height="0.88" rx="0.2" fill="url(#apiGrad)"/>`;
            }
          }
        }
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="1024" height="1024">
  <defs>
    <linearGradient id="apiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color1}" />
      <stop offset="100%" stop-color="${color2}" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="#07111F"/>
  ${rects}
</svg>`;
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(svg);
      } else {
        const QRCode = (await import('qrcode')).default;
        const dataUrl = await QRCode.toDataURL(payload, {
          errorCorrectionLevel: 'H',
          margin: 2,
          color: { dark: '#22D3EE', light: '#07111F' },
          width: 512,
        });
        const imgBuffer = Buffer.from(dataUrl.split(',')[1], 'base64');
        res.setHeader('Content-Type', 'image/png');
        return res.send(imgBuffer);
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // API: STRIPE SUBSCRIPTION CHECKOUT SIMULATOR
  // ==========================================
  app.post('/api/subscription/checkout', (req, res) => {
    const { planId = 'pro', successUrl = '/', cancelUrl = '/' } = req.body;
    const plans: Record<string, { name: string; amount: number; interval: string }> = {
      starter: { name: 'Starter Free', amount: 0, interval: 'month' },
      pro: { name: 'Pro Precision', amount: 1900, interval: 'month' },
      enterprise: { name: 'Enterprise Fleet', amount: 7900, interval: 'month' },
    };

    const plan = plans[planId] || plans.pro;
    const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    res.json({
      success: true,
      sessionId,
      url: `/checkout/simulated?session_id=${sessionId}&plan=${planId}`,
      plan,
      currency: 'usd',
    });
  });

  // ==========================================
  // API: SEO BLOG POSTS & GUIDES
  // ==========================================
  const blogPosts = [
    {
      id: 'post-1',
      slug: 'how-to-create-qr-code-from-url',
      title: 'How to Create a QR Code From a URL: High-Parity Guide',
      category: 'QR Code Guides',
      readTime: '4 min read',
      excerpt: 'Learn how to generate dynamic, machine-readable QR codes from website URLs with instant redirect capabilities and live click telemetry.',
      generatorTarget: 'url',
    },
    {
      id: 'post-2',
      slug: 'how-to-create-qr-code-for-wifi',
      title: 'How to Create a QR Code for Wi-Fi (WPA/WPA3 Auto-Connect)',
      category: 'Tutorials',
      readTime: '3 min read',
      excerpt: 'Set up zero-friction guest and enterprise Wi-Fi networks using WPA2/WPA3 QR standard schemas without password typing friction.',
      generatorTarget: 'wifi',
    },
    {
      id: 'post-3',
      slug: 'static-vs-dynamic-qr-codes',
      title: 'Static vs Dynamic QR Codes: Enterprise Redirection Architecture',
      category: 'Technology',
      readTime: '6 min read',
      excerpt: 'Discover why top global brands mandate dynamic QRs: update destinations without re-printing, track edge telemetry, and enforce cryptographic security.',
      generatorTarget: 'url',
    },
    {
      id: 'post-4',
      slug: 'how-to-add-logo-to-qr-code',
      title: 'How to Add a Logo to a QR Code Without Destroying Scanability',
      category: 'Design & Optics',
      readTime: '5 min read',
      excerpt: 'Deep dive into Reed-Solomon Level H (30%) error correction, quiet zone margins, and optical contrast calibration for brand logos.',
      generatorTarget: 'url',
    },
    {
      id: 'post-5',
      slug: 'how-to-create-qr-code-from-image',
      title: 'How to Create a QR Code From an Image File (Direct Storage Link)',
      category: 'Workflows',
      readTime: '4 min read',
      excerpt: 'Upload photos, infographics, or high-res menus to encrypted object storage and instantly generate direct scanning links.',
      generatorTarget: 'image',
    },
    {
      id: 'post-6',
      slug: 'how-qr-code-analytics-work',
      title: 'How QR Code Analytics Work: Edge Routing & Geolocation Telemetry',
      category: 'Analytics',
      readTime: '5 min read',
      excerpt: 'Understanding device fingerprinting, user-agent parsing, edge POP resolution, and scan velocity monitoring in real-time.',
      generatorTarget: 'analytics',
    },
  ];

  app.get('/api/blog', (_req, res) => {
    res.json({ success: true, posts: blogPosts });
  });

  // ==========================================
  // API: NOTIFICATIONS CENTER
  // ==========================================
  const notifications = [
    {
      id: 'notif-1',
      title: 'Batch #4092 Production Finalized',
      message: '500 serialized dynamic vector SVGs packaged and ready for packaging print.',
      time: '3 mins ago',
      unread: true,
      type: 'bulk',
    },
    {
      id: 'notif-2',
      title: 'Tokyo Flagship Milestone',
      message: 'Reached 42,910 total scans with 7.2ms average dynamic redirect latency.',
      time: '28 mins ago',
      unread: true,
      type: 'telemetry',
    },
    {
      id: 'notif-3',
      title: 'Security Scan Verified (ISO/IEC 18004)',
      message: 'All 48 active dynamic routes verified with Reed-Solomon parity and SSL integrity.',
      time: '2 hours ago',
      unread: true,
      type: 'security',
    },
  ];

  app.get('/api/notifications', (_req, res) => {
    res.json({ success: true, notifications });
  });

  // ==========================================
  // FRONTEND INTEGRATION: VITE IN DEV / STATIC IN PROD
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[QR TO LINK] Full-stack engine running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup failure:', err);
});
