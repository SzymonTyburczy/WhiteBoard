# Virtual Whiteboard

Współpracowa tablica do rysowania z zapisywaniem danych w chmurze.

## 🎯 Cechy

- ✅ **Wiele tablic** - twórz i zarządzaj wieloma tablicami
- ✅ **Dane w chmurze** - wszystko synchronizuje się na serwer
- ✅ **Narzędzia rysowania** - pióro, linie, kształty, tekst
- ✅ **Undo/Redo** - cofaj i ponawiaj działania
- ✅ **Zoom i panorama** - nawigacja po dużych projektach
- ✅ **Eksport PNG** - pobierz tablicę jako obraz
- ✅ **Tryb ciemny** - automatycznie dostosowuje się do motywu systemu

## 🚀 Szybki start - Localhost

### Wymagania

- Node.js 18+
- MongoDB (lokalnie lub MongoDB Atlas)

### Instalacja

1. **Klonuj / pobierz projekt**

```bash
cd VirtualWhiteBoard
```

2. **Zainstaluj zależności**

```bash
npm install
```

3. **Skonfiguruj zmienne środowiskowe**

```bash
cp .env.example .env.local
```

Edytuj `.env.local`:

```
MONGO_URI=mongodb://localhost:27017
PORT=3000
```

4. **Uruchom lokalnie**

```bash
npm run dev
```

Otwórz: `http://localhost:3000`

---

## 📦 Deployment na Vercel

### Krok 1: Przygotuj MongoDB Atlas

1. Przejdź na [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Utwórz bezpłatny klaster
3. Skopiuj connection string (MongoDB URI)

### Krok 2: Wdrażaj na Vercel

1. **Zaloguj się na Vercel**
   - https://vercel.com/login

2. **Utwórz nowy projekt**
   - Kliknij "Add New..." → "Project"
   - Wybierz to repozytorium (GitHub/GitLab/Bitbucket)

3. **Konfiguracja zmiennych**
   - Przejdź do Settings → Environment Variables
   - Dodaj:
     ```
     MONGO_URI = mongodb+srv://user:password@cluster.mongodb.net/whiteboard_app?retryWrites=true&w=majority
     ```

4. **Deploy**
   - Kliknij "Deploy"
   - Czekaj na zakończenie (~2-3 min)

### Krok 3: Testuj na produkcji

Otwórz URL przydzielony przez Vercel (np. `https://whiteboard.vercel.app`)

---

## 📱 Struktura plików

```
VirtualWhiteBoard/
├── server.js              # Backend API (Node.js/Express)
├── package.json           # Zależności
├── vercel.json            # Konfiguracja Vercela
├── .env.example           # Zmienne do skopiowania
├── public/
│   └── index.html         # Frontend
└── README.md
```

---

## 🛠️ API Endpoints

### Tablice

- `GET /api/boards` - Pobierz wszystkie tablice
- `GET /api/boards/:id` - Pobierz tablicę z rysunkami
- `POST /api/boards` - Utwórz nową tablicę
- `PUT /api/boards/:id` - Zapisz rysunki
- `DELETE /api/boards/:id` - Usuń tablicę

### Status

- `GET /api/health` - Sprawdzenie połączenia

---

## ⌨️ Skróty klawiszowe

| Klawisz | Akcja                  |
| ------- | ---------------------- |
| P       | Pióro                  |
| L       | Linia                  |
| R       | Prostokąt              |
| C       | Okrąg                  |
| A       | Strzałka               |
| T       | Tekst                  |
| E       | Gumka                  |
| V       | Przesuwanie            |
| Ctrl+Z  | Cofnij                 |
| Ctrl+Y  | Ponów                  |
| +/-     | Zoom                   |
| 0       | Reset widoku           |
| Spacja  | Tymczasowe przesuwanie |

---

## 🐛 Troubleshooting

### "API connection failed"

- Sprawdź czy backend działa (`npm run dev`)
- Sprawdź czy MongoDB jest dostępna

### "Board not found"

- Upewnij się że MongoDB zawiera dane
- Spróbuj obfreshować stronę (F5)

### Dane nie synchronizują się

- Sprawdź Network tab w DevTools
- Sprawdź czy `MONGO_URI` jest poprawny
- Sprawdź logi serwera

---

## 📄 Licencja

MIT

## 💡 Przyszłe funcjonalności

- [ ] Współedycja w realtime (WebSocket)
- [ ] Uwierzytelnianie użytkowników
- [ ] Udostępnianie tablic
- [ ] Historia zmian
- [ ] Komentarze
- [ ] Export do PDF
