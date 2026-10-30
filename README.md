# LocalShare

Un petit outil web pour échanger des fichiers et du texte entre un téléphone et un PC connectés au même réseau Wi-Fi, sans passer par Internet. Un « AirDrop local » qui fonctionne sur n'importe quel appareil doté d'un navigateur.

Tout reste sur ton réseau : aucun compte, aucun cloud, aucune application à installer sur le téléphone.

## Fonctionnalités

- **Téléphone vers PC** : choisis des photos, vidéos ou documents sur le téléphone, ils arrivent dans le dossier `uploads/` du PC.
- **PC vers téléphone** : glisse-dépose un fichier sur la page, il devient téléchargeable depuis le téléphone.
- **Connexion par QR code** : le QR code s'affiche dans le terminal et sur la page, plus besoin de taper l'adresse IP.
- **Presse-papier partagé** : passe un lien, une note ou un bout de code d'un appareil à l'autre.
- **Barre de progression** avec la vitesse de transfert, y compris pour les gros fichiers.
- **Interface responsive**, thèmes clair et sombre automatiques, aucune ressource chargée depuis Internet.

## Prérequis

- [Node.js](https://nodejs.org) 18 ou plus récent
- Un PC et un téléphone sur le **même réseau Wi-Fi**

## Installation

```bash
git clone https://github.com/Hostine12/localshare.git
cd localshare
npm install
```

## Utilisation

```bash
npm start
```

Le terminal affiche l'adresse du serveur et un QR code :

```
  LocalShare est prêt

  Sur ce PC :     http://localhost:3000
  Sur le réseau : http://192.168.1.20:3000
```

1. **Sur le PC**, ouvre `http://localhost:3000` dans ton navigateur.
2. **Sur le téléphone**, scanne le QR code avec l'appareil photo, ou tape l'adresse « Sur le réseau ».
3. Envoie des fichiers ou du texte depuis l'un ou l'autre des appareils.

Les fichiers reçus sont enregistrés dans le dossier `uploads/`. Laisse le terminal ouvert tant que tu veux utiliser l'application : `Ctrl+C` arrête le serveur.

> N'ouvre pas `public/index.html` en double-cliquant dessus. La page doit être servie par le serveur (`http://localhost:3000`) pour fonctionner.

## Configuration

| Variable | Rôle | Valeur par défaut |
|---|---|---|
| `PORT` | Port d'écoute du serveur | `3000` |
| `LOCALSHARE_IP` | Force l'adresse IP utilisée pour le QR code | détectée automatiquement |

Exemples :

```bash
# macOS / Linux
PORT=4000 npm start
LOCALSHARE_IP=192.168.1.20 npm start
```

```powershell
# Windows (PowerShell)
$env:PORT=4000; npm start
$env:LOCALSHARE_IP="192.168.1.20"; npm start
```

## Structure du projet

```
localshare/
├── server.js        # Serveur Express : routes, envoi/téléchargement, QR code
├── public/
│   └── index.html   # Interface web (HTML, CSS et JavaScript, sans dépendance)
├── uploads/         # Fichiers reçus (créé automatiquement, ignoré par Git)
├── package.json
└── README.md
```

## API

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/upload` | Envoie un ou plusieurs fichiers (champ `files`, format multipart) |
| `GET` | `/files` | Liste les fichiers disponibles |
| `GET` | `/files/:name` | Télécharge un fichier |
| `DELETE` | `/files/:name` | Supprime un fichier |
| `GET` | `/clipboard` | Lit le texte partagé |
| `PUT` | `/clipboard` | Remplace le texte partagé (`{ "text": "..." }`) |
| `GET` | `/info` | Renvoie l'adresse du serveur |
| `GET` | `/qr.svg` | QR code de l'adresse du serveur |

## Dépannage

**Le téléphone n'arrive pas à ouvrir la page**

1. Vérifie que les deux appareils sont sur le **même Wi-Fi** (le téléphone ne doit pas être en données mobiles).
2. **Pare-feu Windows** : autorise Node.js sur les réseaux privés quand Windows le demande. Sinon, ouvre PowerShell en administrateur et lance :
   ```powershell
   New-NetFirewallRule -DisplayName "LocalShare" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private,Public
   ```
3. **Réseaux avec isolation** : certains Wi-Fi (écoles, entreprises, résidences, réseaux invités) empêchent les appareils de se voir entre eux. Active alors le point d'accès mobile de ton téléphone ou de ton PC, connecte l'autre appareil dessus et relance `npm start`.

**Le QR code pointe vers une mauvaise adresse**

Le PC a probablement plusieurs cartes réseau (VirtualBox, VMware, VPN…). Le serveur les écarte automatiquement, mais s'il se trompe, trouve ta vraie adresse avec `ipconfig` (Windows) ou `ip a` (Linux), puis force-la avec `LOCALSHARE_IP`.

**Le bouton « Copier le texte » ne copie rien sur le téléphone**

Les navigateurs limitent l'accès au presse-papier aux connexions sécurisées (HTTPS). Sur une adresse `http://` locale, l'application utilise une méthode de secours, mais certains navigateurs la refusent. Dans ce cas, appuie longuement sur le texte pour le sélectionner et le copier à la main.

## Sécurité

LocalShare est conçu pour un **réseau de confiance** (domicile, hotspot personnel) :

- Il n'y a **aucune authentification** : toute personne connectée au même Wi-Fi peut envoyer, télécharger et supprimer des fichiers, et lire le texte partagé.
- Il n'y a **pas de chiffrement** (HTTP, pas HTTPS) : les données circulent en clair sur le réseau local.
- N'expose pas le port du serveur sur Internet.

Côté code, les noms de fichiers sont nettoyés, les écrasements évités, et les chemins vérifiés pour empêcher l'accès à des fichiers hors de `uploads/`.

## Idées d'amélioration

- Code PIN pour limiter l'accès
- Mises à jour en temps réel (WebSocket) à la place du rafraîchissement toutes les 2,5 secondes
- Historique du presse-papier
- Aperçu des images dans la liste de fichiers
- Suppression automatique des fichiers anciens

## Licence

MIT
