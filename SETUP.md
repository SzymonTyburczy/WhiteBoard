# 🚀 Kompletny Przewodnik: Od Zera do Produkcji

## CZĘŚĆ 1: Uruchomienie Lokalnie (Localhost)

### 1.1 - Instalacja MongoDB lokalnie

**Windows (Zalecane - Docker)**

```powershell
# Jeśli masz Docker, to najprostsze:
docker-compose up -d

# Backend będzie dostępny na http://localhost:3000
```

**Lub instalacja MongoDB bezpośrednio:**

1. Pobierz z https://www.mongodb.com/try/download/community
2. Zainstaluj z domyślnymi opcjami
3. MongoDB będzie uruchomione automatycznie na porcie 27017

### 1.2 - Instalacja Node.js i zależności

```powershell
# Upewnij się że masz Node.js 18+
node --version   # powinno być v18.x lub wyżej

# Zainstaluj npm zależności
npm install
```

### 1.3 - Uruchomienie serwera

```powershell
# Uruchom backend
npm run dev

# Powinno wyświetlić:
# ✓ Connected to MongoDB
# 🚀 Server running on port 3000
```

### 1.4 - Testowanie

Otwórz w przeglądarce: **http://localhost:3000**

Powinieneś zobaczyć:

- ✅ Whiteboard z toolbarem
- ✅ Sidebar z możliwością tworzenia tablic
- ✅ Możliwość rysowania na kanwie
- ✅ Dane automatycznie się zapisują

---

## CZĘŚĆ 2: Deployment na Vercel + MongoDB Atlas

### 2.1 - Utwórz konto MongoDB Atlas (Free!)

1. Przejdź na https://www.mongodb.com/cloud/atlas
2. Zaloguj się lub utwórz konto (darmo)
3. Utwórz nowy projekt
4. Utwórz klaster (wybranie "Free" - 0 koszt)
   - Wybierz region: EU (najszybciej do Polski)
   - Poczekaj 2-5 minut na utworzenie

### 2.2 - Pobierz connection string

W MongoDB Atlas:

1. Kliknij "Connect" na swoim klastrze
2. Wybierz "Drivers" → "Node.js"
3. Skopiuj connection string (wygląda tak):

```
mongodb+srv://username:password@cluster.mongodb.net/whiteboard_app?retryWrites=true&w=majority
```

⚠️ **Zamień `<password>` na swoje hasło!**

### 2.3 - Przygotuj projekt do Vercela

```bash
# Upewnij się że masz git
git --version

# Jeśli nie, przejdź do: https://git-scm.com/download/win

# Zainicjuj repozytorium
git init
git add .
git commit -m "Initial commit"
```

### 2.4 - Wdróż na Vercel

**Opcja A: Przez GitHub (Najłatwiej)**

1. Zaloguj się na https://github.com
2. Utwórz nowe repozytorium
3. Wrzuć kod:

```bash
git remote add origin https://github.com/yourusername/whiteboard.git
git push -u origin main
```

4. Przejdź na https://vercel.com
5. Zaloguj się (możesz przez GitHub)
6. Kliknij "Add New" → "Project"
7. Wybierz swoje repozytorium
8. Kliknij "Deploy"

**Opcja B: Bezpośrednio z Vercela**

1. Przejdź https://vercel.com/new
2. Zaloguj się
3. Wybierz "Import Git Repository"
4. Wklej URL do GitHub repozytorium

### 2.5 - Dodaj zmienne środowiskowe w Vercelu

1. Po kliknięciu Deploy, przejdź do Settings projektu
2. Settings → Environment Variables
3. Dodaj:
   - **Key:** `MONGO_URI`
   - **Value:** Wklej connection string z MongoDB Atlas
   - **Kliknij:** Add
4. Przejdź do Deployments → Kliknij ostatni deploy → Redeploy

Czekaj ~3-5 minut. Powinno działać! 🎉

### 2.6 - Sprawdzenie czy działa

1. Otwórz URL projektu (np. `https://whiteboard-app.vercel.app`)
2. Utwórz tablicę "Test"
3. Narysuj coś
4. Odśwież stronę (F5) - **rysunki powinny być!**
5. Jeśli tak, wszystko działa ✅

---

## CZĘŚĆ 3: Rozwiązywanie problemów

### ❌ Problem: "Cannot connect to MongoDB"

**Przyczyny:**

- MongoDB nie jest uruchomiona
- Connection string jest źle wpisany
- IP nie jest dodane do MongoDB Atlas

**Rozwiązanie:**

```powershell
# Jeśli lokalni MongoDB:
# Sprawdź czy Docker lub MongoDB service jest uruchomiony

# Jeśli MongoDB Atlas:
# W MongoDB Atlas: Network Access → Add Current IP Address
```

### ❌ Problem: "Strona się nie ładuje na Vercel"

**Sprawdzenie:**

1. Przejdź do projektu na Vercelu
2. Kliknij najnowszy deployment
3. Sprawdź "Logs" - czy są błędy
4. Sprawdź czy zmienne środowiskowe są ustawione

**Fix:**

- Dodaj/popraw `MONGO_URI`
- Kliknij "Redeploy" - wdrąż ponownie

### ❌ Problem: "Dane się nie zapisują"

**Przyczyna:** Zwykle problem z połączeniem API

**Sprawdzenie:**

- Otwórz DevTools (F12)
- Przejdź do "Network" tab
- Narysuj coś
- Szukaj POST requestu do `/api/boards`
- Sprawdź status: powinno być 200 OK

---

## 🎯 Checklist przed produkcją

- [ ] ✅ Backend działa lokalnie
- [ ] ✅ Rysunki się zapisują lokalnie
- [ ] ✅ MongoDB Atlas utworzony
- [ ] ✅ Projekt na GitHub/GitLab
- [ ] ✅ Projekt na Vercelu
- [ ] ✅ Zmienne środowiskowe ustawione
- [ ] ✅ Testowanie na Vercelu - dane się zapisują
- [ ] ✅ Możliwość tworzenia wielu tablic
- [ ] ✅ Eksport PNG działa

---

## 📊 Co się dzieje pod maską

### Architektura

```
Użytkownik
    ↓
[Frontend - Canvas HTML5]  ← Rysowanie
    ↓
[Express Server - Node.js]  ← API
    ↓
[MongoDB]  ← Przechowywanie danych
```

### Przepływ danych

1. **Rysowanie** - Użytkownik rysuje → dane w zmiennej `shapes` w JS
2. **Autosave** - Co 800ms dane wysyłane do API
3. **API** - `PUT /api/boards/:id` zapisuje rysunki w MongoDB
4. **Przełączanie tablic** - Pobiera dane API `GET /api/boards/:id`
5. **Odświeżenie** - Dane są trwałe w MongoDB

---

## 🔒 Security notes

- Brak uwierzytelniania - każdy może edytować wszystkie tablice
- Dodaj logowanie użytkowników (sesje/JWT) dla produkcji
- MongoDB Atlas automatycznie szyfruje połączenia (SSL)

---

## 📞 Pomoc

Jeśli coś nie działa, sprawdź:

1. **Logi serwera** - Node.js powinno wyświetlić błędy
2. **DevTools** - F12 → Console → czy są błędy JS
3. **MongoDB Atlas dashboard** - czy klaster jest uruchomiony
4. **Vercel Logs** - czy deployment się powiódł

---

## 🚀 Następne kroki

Po wdrożeniu na produkcję, możesz dodać:

- [ ] Logowanie użytkowników
- [ ] Udostępnianie tablic (ShareBoard)
- [ ] Współedycja w realtime (WebSocket)
- [ ] Historia zmian
- [ ] Backup do Google Drive / iCloud
- [ ] Mobile app (React Native)

Powodzenia! 🎉
