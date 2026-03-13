// This script initializes Firebase and attaches the 'db' and 'isConfigured' flag to the window object.
// Use this as a regular <script src="firebase-config.js"></script>

(function () {
    const firebaseConfig = {
        apiKey: "AIzaSyC42tvDmM6hMlW8OAlGjWf9goIrdna5X60",
        authDomain: "fee-3c417.firebaseapp.com",
        projectId: "fee-3c417",
        storageBucket: "fee-3c417.firebasestorage.app",
        messagingSenderId: "653640202868",
        appId: "1:653640202868:web:7b8713168914feaffe6f21",
        measurementId: "G-8DRJWXDQD7"
    };

    window.isConfigured = false;
    window.db = null;

    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
        try {
            // Initialize the Firebase app using the compat layer (assumes firebase global exists)
            firebase.initializeApp(firebaseConfig);
            window.db = firebase.firestore();
            window.auth = firebase.auth();
            window.isConfigured = true;
            console.log("Firebase Firestore & Auth initialized (Compat mode).");
        } catch (e) {
            console.error("Firebase initialization failed:", e);
        }
    } else {
        console.warn("Firebase not configured. Using LocalStorage fallback.");
    }
})();
