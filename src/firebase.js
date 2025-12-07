import React, { useState, useEffect } from 'react';
import { MessageCircle, ShoppingCart, LogOut, User, Send, X, Volume2, VolumeX, Mail, Bell } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where, getDocs } from 'firebase/firestore';
// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBr3_qiLystMIrqotIqKSOFVCK5b8uxy00",
  authDomain: "prodavnica-fe957.firebaseapp.com",
  projectId: "prodavnica-fe957",
  storageBucket: "prodavnica-fe957.firebasestorage.app",
  messagingSenderId: "25943607074",
  appId: "1:25943607074:web:357f70c7c58bdc1b37477b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [showSellerModal, setShowSellerModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chats, setChats] = useState({});
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [sellerInbox, setSellerInbox] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const audioRef = React.useRef(null);

  // ADMIN CONFIG
  const product = {
    name: "Romski vaucer",
    price: "9,750",
    image: "https://cdn.discordapp.com/attachments/1255898740347240549/1446997580402659490/vaucer-10000.jpg?ex=69360503&is=6934b383&hm=69ca345c7dd3a54436d2ca0f05c1af2f60ead36d02b6218e63211ac11d2a3147&",
    description: "Vucicu romski vaucer 10k din planeta sport ingor patike nemanja jordan"
  };

   const musicUrl = "/music.mp3";


  // PRODAVCI - Username i Password
  const sellers = [
    { id: 1, name: "Milena", avatar: "M", color: "from-purple-600 to-pink-600", username: "milena", password: "milena123" },
    { id: 2, name: "Anastasija", avatar: "A", color: "from-blue-600 to-purple-600", username: "anastasija", password: "anastasija123" },
    { id: 3, name: "Kostolacka Majka", avatar: "K", color: "from-green-600 to-teal-600", username: "kostolacka", password: "kostolacka123" },
    { id: 4, name: "Nemanja", avatar: "N", color: "from-orange-600 to-red-600", username: "nemanja", password: "nemanja123" }
  ];

  // Proveri da li je korisnik prodavac
  const isSeller = currentUser && sellers.some(s => s.username === currentUser.username);
  const sellerData = sellers.find(s => s.username === currentUser?.username);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser({ 
          username: user.email.split('@')[0], 
          uid: user.uid,
          email: user.email
        });
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load volume settings
  useEffect(() => {
    const savedVolume = localStorage.getItem('volume');
    if (savedVolume) setVolume(parseFloat(savedVolume));
    const savedMuted = localStorage.getItem('isMuted');
    if (savedMuted) setIsMuted(savedMuted === 'true');
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Seller Inbox - Sluša sve chat-ove za ovog prodavca
  useEffect(() => {
    if (!isSeller || !sellerData) return;

    const loadInbox = async () => {
      const inboxData = [];
      const chatSnapshots = await getDocs(collection(db, 'chats'));
      
      for (const chatDoc of chatSnapshots.docs) {
        const chatId = chatDoc.id;
        // Proveri da li je chat za ovog prodavca (chatId format: userId-sellerId)
        if (chatId.includes(`-${sellerData.id}`)) {
          const messagesQuery = query(
            collection(db, 'chats', chatId, 'messages'),
            orderBy('timestamp', 'desc')
          );
          
          const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            const messages = snapshot.docs.map(doc => doc.data());
            if (messages.length > 0) {
              const lastMessage = messages[0];
              const buyerUid = chatId.split('-')[0];
              
              setSellerInbox(prev => {
                const existing = prev.find(chat => chat.chatId === chatId);
                if (existing) {
                  return prev.map(chat => 
                    chat.chatId === chatId 
                      ? { ...chat, lastMessage: lastMessage.text, timestamp: lastMessage.timestamp, messages }
                      : chat
                  );
                } else {
                  return [...prev, {
                    chatId,
                    buyerName: lastMessage.sender,
                    buyerUid,
                    lastMessage: lastMessage.text,
                    timestamp: lastMessage.timestamp,
                    messages
                  }];
                }
              });
            }
          });
        }
      }
    };

    loadInbox();
  }, [isSeller, sellerData]);

  // Real-time chat listener (za kupce i prodavce u chatu)
  useEffect(() => {
    if (!selectedSeller || !currentUser) return;

    const chatKey = isSeller 
      ? selectedChat?.chatId 
      : `${currentUser.uid}-${selectedSeller.id}`;
    
    if (!chatKey) return;

    const q = query(
      collection(db, 'chats', chatKey, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          text: data.text,
          sender: data.senderUid === currentUser.uid ? 'user' : 'seller',
          senderName: data.sender,
          timestamp: data.timestamp?.toDate ? 
            data.timestamp.toDate().toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }) : 
            'Šalje se...'
        };
      });
      setChats(prev => ({ ...prev, [chatKey]: messages }));
    });

    return () => unsubscribe();
  }, [selectedSeller, currentUser, selectedChat, isSeller]);

const handleAuth = async (e) => {
  e.preventDefault();
  
  if (!authForm.username || !authForm.password) {
    alert('Popuni sva polja!');
    return;
  }

  // Proveri da li je prodavac
  const seller = sellers.find(s => s.username === authForm.username);
  
  if (seller) {
    // JE PRODAVAC
    if (authForm.password !== seller.password) {
      alert('Pogrešna lozinka za prodavca!');
      return;
    }
    
    const email = `seller-${authForm.username}@marketplace.com`;
    
    try {
      // Prvo pokušaj login
      try {
        await signInWithEmailAndPassword(auth, email, seller.password);
        console.log('✅ Prodavac login uspešan!');
      } catch (loginError) {
        // Ako nalog ne postoji, kreiraj ga
        if (loginError.code === 'auth/user-not-found' || loginError.code === 'auth/invalid-credential') {
          console.log('🆕 Kreiram novi prodavac nalog...');
          await createUserWithEmailAndPassword(auth, email, seller.password);
          console.log('✅ Prodavac nalog kreiran!');
        } else {
          throw loginError;
        }
      }
      
      setShowAuth(false);
      setAuthForm({ username: '', password: '' });
      return;
      
    } catch (error) {
      console.error('❌ Greška:', error);
      alert('Greška pri logovanju: ' + error.message);
      return;
    }
  }

  // OBIČAN KUPAC
  const email = authForm.username + '@marketplace.com';
  
  try {
    if (isRegister) {
      await createUserWithEmailAndPassword(auth, email, authForm.password);
      alert('✅ Uspešna registracija!');
    } else {
      await signInWithEmailAndPassword(auth, email, authForm.password);
    }
    setShowAuth(false);
    setAuthForm({ username: '', password: '' });
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      alert('Korisničko ime već postoji!');
    } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      alert('Korisnik ne postoji! Registruj se prvo.');
    } else if (error.code === 'auth/wrong-password') {
      alert('Pogrešna lozinka!');
    } else if (error.code === 'auth/weak-password') {
      alert('Lozinka mora imati minimum 6 karaktera!');
    } else {
      alert('Greška: ' + error.message);
    }
  }
};

  const handleLogout = async () => {
    await signOut(auth);
    setSelectedSeller(null);
    setSelectedChat(null);
    setSellerInbox([]);
  };

  const handleBuyClick = () => {
    if (!currentUser) {
      setShowAuth(true);
    } else {
      setShowSellerModal(true);
    }
  };

  const handleSelectSeller = (seller) => {
    setSelectedSeller(seller);
    setShowSellerModal(false);
  };

  const handleOpenChat = (inboxItem) => {
    setSelectedChat(inboxItem);
    setSelectedSeller(sellerData);
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !selectedSeller || !currentUser) return;

    const chatKey = isSeller 
      ? selectedChat?.chatId 
      : `${currentUser.uid}-${selectedSeller.id}`;
    
    try {
      await addDoc(collection(db, 'chats', chatKey, 'messages'), {
        text: chatMessage,
        sender: currentUser.username,
        senderUid: currentUser.uid,
        sellerId: selectedSeller.id,
        timestamp: serverTimestamp(),
      });
      setChatMessage('');
    } catch (error) {
      console.error('Greška pri slanju:', error);
      alert('Greška pri slanju poruke.');
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    localStorage.setItem('volume', newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    localStorage.setItem('isMuted', newMuted);
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(err => console.log('Autoplay prevented:', err));
    }
  };

  const currentChat = selectedSeller && currentUser 
    ? chats[isSeller ? selectedChat?.chatId : `${currentUser.uid}-${selectedSeller.id}`] || []
    : [];

  return (
    <div className="min-h-screen bg-zinc-950" onClick={playAudio}>
      {/* Audio Element */}
      <audio ref={audioRef} loop autoPlay>
        <source src={musicUrl} type="audio/mpeg" />
      </audio>

      {/* Music Control Panel */}
      <div className="fixed top-24 right-6 bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-xl z-50 w-64">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white text-sm font-medium">🎵 Muzika</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-lg transition-colors"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-zinc-400" /> : <Volume2 className="w-5 h-5 text-amber-600" />}
          </button>
        </div>
        <div className="flex items-center space-x-3">
          <VolumeX className="w-4 h-4 text-zinc-500" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
          />
          <Volume2 className="w-4 h-4 text-zinc-400" />
        </div>
        <div className="text-center mt-2">
          <span className="text-amber-600 font-semibold text-sm">{Math.round(volume * 100)}%</span>
        </div>
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #B45309;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #B45309;
          cursor: pointer;
          border: none;
        }
      `}</style>

      {/* Header */}
      <nav className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-8 h-8 text-amber-700" />
              <span className="text-2xl font-bold text-white tracking-tight">
                Vucicshop
              </span>
              {isSeller && (
                <span className="bg-amber-800 text-white text-xs px-3 py-1 rounded-full ml-4">
                  PRODAVAC
                </span>
              )}
            </div>
            
            {currentUser ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-zinc-800 px-4 py-2 rounded-lg border border-zinc-700">
                  <User className="w-5 h-5 text-zinc-400" />
                  <span className="text-zinc-200">{currentUser.username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="bg-amber-800 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-medium transition-all"
              >
                Prijavi se
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {isSeller ? (
          // SELLER DASHBOARD
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-6">
                <Mail className="w-8 h-8 text-amber-600" />
                <h2 className="text-3xl font-bold text-white">Inbox - {sellerData?.name}</h2>
                <span className="bg-amber-800 text-white px-3 py-1 rounded-full text-sm">
                  {sellerInbox.length} poruka
                </span>
              </div>

              {sellerInbox.length === 0 ? (
                <p className="text-zinc-400 text-center py-8">Još uvek nemaš poruka</p>
              ) : (
                <div className="space-y-3">
                  {sellerInbox.map((chat, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleOpenChat(chat)}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 p-4 rounded-lg border border-zinc-700 text-left transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-semibold">{chat.buyerName}</p>
                          <p className="text-zinc-400 text-sm truncate mt-1">{chat.lastMessage}</p>
                        </div>
                        <Bell className="w-5 h-5 text-amber-600" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          // KUPAC VIEW
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="relative">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-[500px] object-cover rounded-lg shadow-xl"
              />
            </div>

            <div className="space-y-6">
              <div>
                <h1 className="text-5xl font-bold text-white mb-4">{product.name}</h1>
                <p className="text-lg text-zinc-400 leading-relaxed">{product.description}</p>
              </div>

              <div className="flex items-baseline space-x-2">
                <span className="text-5xl font-bold text-white">{product.price}</span>
                <span className="text-2xl text-zinc-500">RSD</span>
              </div>

              <button
                onClick={handleBuyClick}
                className="w-full bg-amber-800 hover:bg-amber-700 text-white text-xl font-semibold py-4 rounded-lg transition-all"
              >
                Kupi odmah
              </button>

              <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
                <h3 className="text-white font-semibold mb-3">Zašto kupiti kod nas?</h3>
                <ul className="space-y-2 text-zinc-400">
                  <li>✓ Bez prevare</li>
                  <li>✓ Romska roba</li>
                  <li>✓ Free 5g spid mozda i mdma</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-lg p-8 max-w-md w-full border border-zinc-800 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white">
                {isRegister ? 'Registracija' : 'Prijava'}
              </h2>
              <button onClick={() => setShowAuth(false)} className="text-zinc-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Korisničko ime"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                className="w-full bg-zinc-800 text-white placeholder-zinc-500 px-4 py-3 rounded-lg border border-zinc-700 focus:border-amber-800 focus:outline-none"
              />
              <input
                type="password"
                placeholder="Lozinka"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleAuth(e)}
                className="w-full bg-zinc-800 text-white placeholder-zinc-500 px-4 py-3 rounded-lg border border-zinc-700 focus:border-amber-800 focus:outline-none"
              />
              <button
                onClick={handleAuth}
                className="w-full bg-amber-800 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg transition-all"
              >
                {isRegister ? 'Registruj se' : 'Prijavi se'}
              </button>
            </div>

            <button
              onClick={() => setIsRegister(!isRegister)}
              className="w-full text-zinc-400 text-sm mt-4 hover:text-white"
            >
              {isRegister ? 'Već imaš nalog? Prijavi se' : 'Nemaš nalog? Registruj se'}
            </button>

            <div className="mt-6 pt-6 border-t border-zinc-800">
              <p className="text-zinc-400 text-xs text-center mb-2">Prodavac? Koristi:</p>
              <div className="space-y-1 text-xs text-zinc-500">
                <p>kostolacka / kostolacka123</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seller Selection Modal */}
      {showSellerModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-lg p-8 max-w-2xl w-full border border-zinc-800 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white">Izaberi prodavca</h2>
              <button onClick={() => setShowSellerModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {sellers.map(seller => (
                <button
                  key={seller.id}
                  onClick={() => handleSelectSeller(seller)}
                  className="bg-zinc-800 p-6 rounded-lg border border-zinc-700 hover:border-amber-800 hover:bg-zinc-800/80 transition-all"
                >
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${seller.color} flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3`}>
                    {seller.avatar}
                  </div>
                  <p className="text-white font-semibold text-center">{seller.name}</p>
                  <div className="flex items-center justify-center mt-2 text-zinc-400 text-sm">
                    <MessageCircle className="w-4 h-4 mr-1" />
                    Chat
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chat Window */}
      {selectedSeller && (isSeller ? selectedChat : true) && (
        <div className="fixed bottom-6 right-6 w-96 bg-zinc-900 rounded-lg border border-zinc-800 shadow-xl overflow-hidden z-50">
          <div className={`bg-gradient-to-r ${selectedSeller.color} p-4 flex justify-between items-center`}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-white font-bold">
                {isSeller ? selectedChat?.buyerName[0]?.toUpperCase() : selectedSeller.avatar}
              </div>
              <div>
                <p className="text-white font-semibold">
                  {isSeller ? selectedChat?.buyerName : selectedSeller.name}
                </p>
                <p className="text-white/70 text-sm">Online</p>
              </div>
            </div>
            <button onClick={() => {
              setSelectedSeller(null);
              setSelectedChat(null);
            }} className="text-white hover:bg-black/20 p-2 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="h-96 overflow-y-auto p-4 space-y-3 bg-zinc-950">
            {currentChat.length === 0 ? (
              <p className="text-zinc-500 text-center text-sm mt-8">
                {isSeller ? 'Čeka se poruka...' : `Počni razgovor sa ${selectedSeller.name}`}
              </p>
            ) : (
              currentChat.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] ${msg.sender === 'user' ? 'bg-amber-800' : 'bg-zinc-800'} rounded-lg px-4 py-2`}>
                    <p className="text-white text-sm">{msg.text}</p>
                    <p className="text-white/50 text-xs mt-1">{msg.timestamp}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 bg-zinc-900 border-t border-zinc-800">
            <div className="flex space-x-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Napiši poruku..."
                className="flex-1 bg-zinc-800 text-white placeholder-zinc-500 px-4 py-2 rounded-lg border border-zinc-700 focus:border-amber-800 focus:outline-none"
              />
              <button
                onClick={handleSendMessage}
                className="bg-amber-800 hover:bg-amber-700 p-2 rounded-lg transition-all"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;