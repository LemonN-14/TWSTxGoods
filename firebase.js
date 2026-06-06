const firebaseConfig = {
  apiKey: "AIzaSyCNIo57_LoA3uosJ5i991jwrHSaw-lewOc",
  authDomain: "twstxgoods-44ee1.firebaseapp.com",
  databaseURL: "https://twstxgoods-44ee1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "twstxgoods-44ee1",
  storageBucket: "twstxgoods-44ee1.firebasestorage.app",
  messagingSenderId: "100980544241",
  appId: "1:100980544241:web:0ae6f5d6f625fc7ce8cf50",
  measurementId: "G-3FF2MK7QF5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// สร้าง Instances ไว้ใช้งาน (ใช้แค่ Auth และ Firestore)
const auth = firebase.auth();
const db = firebase.firestore();