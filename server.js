// LocalShare — serveur local (Express + Multer + QR code)
const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const os = require('os');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Utilitaires ----------

// Liste les adresses IPv4 locales, la plus probable (Wi-Fi) en premier.
// Les cartes virtuelles (VirtualBox, VMware, WSL, Docker, VPN...) sont reléguées en fin de liste.
function getLocalIPs() {
  const virtual = /virtual|vmware|vbox|vethernet|hyper-v|wsl|docker|tailscale|zerotier|vpn|bluetooth|loopback|\btap\b|\btun\b/i;
  const isPrivate = (ip) =>
    /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
  const list = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal) continue;
      let score = 0;
      if (isPrivate(a.address)) score += 1;
      if (/wi-?fi|wlan|wireless|sans fil/i.test(name)) score += 4;
      else if (/^(ethernet|eth|en\d)/i.test(name)) score += 2;
      if (virtual.test(name) || a.address.startsWith('192.168.56.')) score -= 10; // 192.168.56.x = VirtualBox
      if (a.address.startsWith('169.254.')) score -= 20; // adresse auto-attribuée, pas de réseau
      list.push({ name, address: a.address, score });
    }
  }
  return list.sort((x, y) => y.score - x.score);
}

// Adresse utilisée pour le QR code (peut être forcée : set LOCALSHARE_IP=192.168.1.20)
function getLocalIP() {
  return process.env.LOCALSHARE_IP || getLocalIPs()[0]?.address || 'localhost';
}

// Les noms de fichiers peuvent arriver mal décodés (latin1 au lieu d'UTF-8)
function fixName(name) {
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return decoded.includes('\uFFFD') ? name : decoded;
  } catch {
    return name;
  }
}

// Nettoie le nom et évite d'écraser un fichier existant
function safeUniqueName(original) {
  let base = path.basename(fixName(original)).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || 'fichier';
  const ext = path.extname(base);
  const stem = path.basename(base, ext);
  let name = base;
  let i = 1;
  while (fs.existsSync(path.join(UPLOAD_DIR, name))) {
    name = `${stem} (${i++})${ext}`;
  }
  return name;
}

// Chemin sûr (empêche la traversée de répertoire)
function resolveFile(name) {
  const full = path.join(UPLOAD_DIR, path.basename(name));
  return full.startsWith(UPLOAD_DIR + path.sep) ? full : null;
}

// ---------- Application ----------

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, safeUniqueName(file.originalname)),
});
const upload = multer({ storage }); // pas de limite de taille : c'est un réseau privé

// Envoi de fichiers (téléphone ou PC -> dossier uploads/)
app.post('/upload', upload.array('files'), (req, res) => {
  const saved = (req.files || []).map((f) => ({ name: f.filename, size: f.size }));
  console.log(`⬆  ${saved.map((f) => f.name).join(', ')}`);
  res.json({ saved });
});

// Liste des fichiers disponibles
app.get('/files', (req, res) => {
  const files = fs
    .readdirSync(UPLOAD_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith('.'))
    .map((d) => {
      const st = fs.statSync(path.join(UPLOAD_DIR, d.name));
      return { name: d.name, size: st.size, modified: st.mtimeMs };
    })
    .sort((a, b) => b.modified - a.modified);
  res.json(files);
});

// Téléchargement
app.get('/files/:name', (req, res) => {
  const full = resolveFile(req.params.name);
  if (!full || !fs.existsSync(full)) return res.status(404).json({ error: 'Fichier introuvable' });
  res.download(full);
});

// Suppression
app.delete('/files/:name', (req, res) => {
  const full = resolveFile(req.params.name);
  if (!full || !fs.existsSync(full)) return res.status(404).json({ error: 'Fichier introuvable' });
  fs.unlinkSync(full);
  res.json({ ok: true });
});

// Presse-papier partagé (en mémoire)
let clipboard = { text: '', updated: 0 };
app.get('/clipboard', (req, res) => res.json(clipboard));
app.put('/clipboard', (req, res) => {
  const text = typeof req.body.text === 'string' ? req.body.text.slice(0, 100000) : '';
  clipboard = { text, updated: Date.now() };
  res.json(clipboard);
});

// Infos de connexion + QR code (SVG) pour l'afficher sur la page du PC
const url = () => `http://${getLocalIP()}:${PORT}`;
app.get('/info', (req, res) => res.json({ url: url() }));
app.get('/qr.svg', async (req, res) => {
  res.type('image/svg+xml').send(await QRCode.toString(url(), { type: 'svg', margin: 1 }));
});

// Erreurs (ex. envoi interrompu)
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, '0.0.0.0', async () => {
  const link = url();
  console.log('\n  LocalShare est prêt\n');
  console.log(`  Sur ce PC :     http://localhost:${PORT}`);
  console.log(`  Sur le réseau : ${link}`);
  const others = getLocalIPs().filter((i) => `http://${i.address}:${PORT}` !== link);
  if (others.length) {
    console.log('  Autres adresses détectées :');
    others.forEach((i) => console.log(`    http://${i.address}:${PORT}  (${i.name})`));
  }
  console.log();
  console.log(await QRCode.toString(link, { type: 'terminal', small: true }));
  console.log('  Scanne le QR code avec ton téléphone (même Wi-Fi).\n');
  console.log(`  Fichiers reçus dans : ${UPLOAD_DIR}\n`);
});