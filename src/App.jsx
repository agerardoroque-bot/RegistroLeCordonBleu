import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Users, 
  ShieldCheck, 
  CheckCircle, 
  AlertTriangle, 
  UserPlus, 
  LogOut 
} from 'lucide-react';
// 1. Importación simplificada (quitamos getApps y getApp que causaban el error)
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, onSnapshot, addDoc } from 'firebase/firestore';

// 2. TU CONFIGURACIÓN REAL DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyARvnoUlbzzN0xhrBBrDZQECga3kMWiTN8",
  authDomain: "gerardo-roque.firebaseapp.com",
  projectId: "gerardo-roque",
  storageBucket: "gerardo-roque.firebasestorage.app",
  messagingSenderId: "15051236703",
  appId: "1:15051236703:web:fd2451e97d202b41fec2ea",
  measurementId: "G-6SZ8M3BG0N"
};

// 3. Inicialización directa y a prueba de fallos
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [eventId, setEventId] = useState(''); 
  
  // Estados del Docente
  const [currentToken, setCurrentToken] = useState('');
  const [countdown, setCountdown] = useState(10);
  const [attendees, setAttendees] = useState([]);
  
  // Estados del Alumno
  const [scannedToken, setScannedToken] = useState('');
  const [isValidated, setIsValidated] = useState(false);
  const [studentError, setStudentError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    matricula: '',
    nombre: '',
    licenciatura: ''
  });

  // 1. Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Error Auth:", error);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Lector de QR (Parámetros URL)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const eventFromUrl = urlParams.get('event');
    if (tokenFromUrl && eventFromUrl) {
      setView('student');
      setScannedToken(tokenFromUrl);
      setEventId(eventFromUrl);
    }
  }, []);

  // 3. Generador de Token (Docente)
  useEffect(() => {
    if (!user || view !== 'teacher' || !eventId) return;
    
    const eventDocRef = doc(db, 'eventos_activos', eventId);
    
    const updateToken = async () => {
      const newToken = Math.random().toString(36).substring(2, 12);
      setCurrentToken(newToken);
      setCountdown(10);
      try {
        await setDoc(eventDocRef, { token: newToken, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (e) { console.error("Error actualizando token:", e); }
    };

    updateToken();
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { updateToken(); return 10; }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [user, view, eventId]);

  // 4. Escucha de Asistentes (Tiempo Real)
  useEffect(() => {
    if (!user || view !== 'teacher' || !eventId) return;
    
    const q = query(collection(db, 'asistentes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.eventId === eventId) list.push({ id: doc.id, ...data });
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAttendees(list);
    }, (err) => console.error("Error en Snapshot:", err));
    
    return () => unsubscribe();
  }, [user, view, eventId]);

  // 5. Verificador de Token (Alumno)
  useEffect(() => {
    if (!user || view !== 'student' || isValidated || !scannedToken || !eventId) return;
    
    const checkToken = async () => {
      const eventDocRef = doc(db, 'eventos_activos', eventId);
      try {
        const docSnap = await getDoc(eventDocRef);
        if (docSnap.exists() && docSnap.data().token === scannedToken) {
          setIsValidated(true);
          setStudentError(null);
        } else {
          setStudentError("El código QR ha expirado. Espera a que el docente muestre el siguiente y vuelve a escanear.");
        }
      } catch (e) { 
        setStudentError("Error de conexión al validar el código."); 
      }
    };
    checkToken();
  }, [user, view, scannedToken, isValidated, eventId]);

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    if (!isValidated) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'asistentes'), {
        ...formData,
        eventId,
        timestamp: new Date().toISOString()
      });
      setSuccess(true);
    } catch (e) { 
      setStudentError("Error al guardar el registro."); 
      console.error(e);
    }
    setIsSubmitting(false);
  };

  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-bold uppercase tracking-widest text-xs text-center">Iniciando sistema...</p>
    </div>
  );

  // --- VISTA INICIAL ---
  if (view === 'home') return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
        <div className="bg-indigo-600 p-10 text-center text-white">
          <ShieldCheck className="w-20 h-20 mx-auto mb-4 drop-shadow-lg" />
          <h1 className="text-3xl font-extrabold tracking-tight">Registro Seguro</h1>
          <p className="opacity-80 font-medium">Panel de Asistencia</p>
        </div>
        <div className="p-10 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID de la Clase o Evento</label>
            <input 
              type="text" placeholder="Ej. Hoteleria101" 
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-800"
              value={eventId} onChange={(e) => setEventId(e.target.value.trim())}
            />
          </div>
          <button 
            disabled={!eventId} onClick={() => setView('teacher')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black shadow-xl transition-all disabled:opacity-40 active:scale-95 flex justify-center items-center gap-2"
          >
            <QrCode size={20} /> GENERAR QR DOCENTE
          </button>
        </div>
      </div>
    </div>
  );

  // --- VISTA DOCENTE ---
  if (view === 'teacher') {
    const baseUrl = window.location.href.split('?')[0];
    const qrUrl = `${baseUrl}?event=${eventId}&token=${currentToken}`;
    const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}&margin=10`;

    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-slate-800">
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm mb-8 border border-slate-200">
          <div className="flex items-center gap-4 text-slate-800">
            <div className="bg-indigo-600 p-3 rounded-xl text-white"><ShieldCheck size={24} /></div>
            <div>
              <h2 className="font-black text-lg">Sala: {eventId}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Monitoreo en vivo</p>
            </div>
          </div>
          <button onClick={() => setView('home')} className="bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-600 px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all">
            <LogOut size={18} /> Salir
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white rounded-[2.5rem] shadow-xl p-10 flex flex-col items-center text-center border border-slate-200 h-fit sticky top-8">
            <h2 className="font-black text-slate-800 text-sm mb-8 uppercase tracking-widest">Escanea el QR actual</h2>
            <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 mb-6 relative">
              {countdown <= 1 && (
                <div className="absolute inset-0 bg-white/80 rounded-3xl flex items-center justify-center z-10 backdrop-blur-sm">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              <img src={qrImageSrc} alt="QR" className="w-64 h-64 object-contain mix-blend-multiply" />
            </div>

            <div className="w-full text-slate-800">
              <div className="flex justify-between text-[10px] mb-2 font-black uppercase text-slate-400">
                <span>Actualización en:</span>
                <span className={countdown <= 3 ? 'text-red-500 animate-pulse' : 'text-indigo-600'}>{countdown}s</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-1000 ease-linear" style={{width: `${(countdown/10)*100}%`}}></div>
              </div>
              <p className="mt-6 text-xs text-slate-400 font-medium">Este código cambia cada 10 segundos para evitar que sea compartido fuera del aula.</p>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-xl p-8 flex flex-col min-h-[500px] border border-slate-200 text-slate-800">
            <div className="flex justify-between items-center mb-8 text-slate-800">
              <h2 className="text-xl font-black flex items-center gap-3"><Users className="text-indigo-600" /> Asistentes</h2>
              <div className="bg-emerald-500 text-white px-6 py-1 rounded-full font-black text-xl shadow-lg">{attendees.length}</div>
            </div>
            <div className="flex-1 overflow-auto rounded-3xl border border-slate-100 bg-slate-50/50">
              <table className="w-full text-left">
                <thead className="bg-slate-100/80 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-200">
                  <tr>
                    <th className="p-6">Matrícula</th>
                    <th className="p-6">Nombre</th>
                    <th className="p-6">Licenciatura</th>
                    <th className="p-6 text-right">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {attendees.map(a => (
                    <tr key={a.id} className="bg-white hover:bg-indigo-50/40 transition-colors">
                      <td className="p-6 font-mono font-bold text-indigo-600">{a.matricula}</td>
                      <td className="p-6 font-black text-slate-800">{a.nombre}</td>
                      <td className="p-6"><span className="text-[9px] font-black bg-slate-100 px-3 py-1 rounded-lg text-slate-500 uppercase">{a.licenciatura}</span></td>
                      <td className="p-6 text-slate-400 font-bold tabular-nums text-right">{new Date(a.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    </tr>
                  ))}
                  {!attendees.length && (
                    <tr><td colSpan="4" className="p-24 text-center text-slate-400 font-bold italic">Esperando registros...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA ALUMNO ---
  if (view === 'student') return (
    <div className="min-h-screen bg-indigo-600 flex flex-col items-center p-6 pt-12 text-slate-900">
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white/20">
        <div className="bg-indigo-700 p-10 text-center text-white relative">
          <UserPlus className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-black tracking-tight">Pase de Lista</h1>
          <p className="opacity-80 mt-2 text-sm font-medium">Clase: {eventId}</p>
        </div>
        <div className="p-10 text-slate-800">
          {studentError && !isValidated ? (
            <div className="text-center p-6 bg-red-50 rounded-3xl border border-red-100">
              <AlertTriangle className="text-red-500 w-16 h-16 mx-auto mb-4" />
              <p className="text-red-600 font-bold">{studentError}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-6 text-sm font-bold text-slate-500 hover:text-slate-800 underline"
              >
                Volver a intentar
              </button>
            </div>
          ) : success ? (
            <div className="text-center py-16 animate-in zoom-in duration-500">
              <CheckCircle className="text-emerald-500 w-32 h-32 mx-auto mb-8 animate-bounce" />
              <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">¡Listo!</h2>
              <p className="text-slate-500 font-bold mt-2">Registro completado con éxito.</p>
              <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 inline-block text-left w-full">
                <p className="text-xs text-slate-400 font-bold uppercase">Matrícula</p>
                <p className="font-mono font-bold text-slate-800">{formData.matricula}</p>
                <p className="text-xs text-slate-400 font-bold uppercase mt-2">Hora de registro</p>
                <p className="font-mono font-bold text-slate-800">{new Date().toLocaleTimeString()}</p>
              </div>
            </div>
          ) : isValidated ? (
            <form onSubmit={handleStudentSubmit} className="space-y-6">
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                <ShieldCheck size={20} /> Presencia física validada
              </div>
              <input required placeholder="Escribe tu matrícula" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all" value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} />
              <input required placeholder="Escribe tu nombre completo" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
              <select required className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer" value={formData.licenciatura} onChange={e => setFormData({...formData, licenciatura: e.target.value})}>
                <option value="" disabled>Selecciona tu licenciatura...</option>
                <option value="Dirección de Restaurantes">Dirección de Restaurantes</option>
                <option value="Dirección Internacional de Hoteles">Dirección Internacional de Hoteles</option>
                <option value="Gastronomía">Gastronomía</option>
                <option value="Gastronomy">Gastronomy</option>
                <option value="International Hotel Management">International Hotel Management</option>
                <option value="Turismo Internacional">Turismo Internacional</option>
              </select>
              <button disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black text-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95 flex justify-center items-center">
                {isSubmitting ? <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : "REGISTRARME"}
              </button>
            </form>
          ) : (
            <div className="text-center py-24 flex flex-col items-center">
              <div className="w-12 h-12 border-8 border-indigo-600 border-t-transparent rounded-full animate-spin mb-6"></div>
              <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Validando presencia física...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return null;
}