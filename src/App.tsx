import React, { useState, useEffect, useRef } from 'react';
import { motion, Variants, AnimatePresence } from 'motion/react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { 
  Download, 
  ExternalLink, 
  Shield, 
  Zap, 
  Users, 
  ArrowRight, 
  Lock, 
  Unlock, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Search, 
  Package, 
  LogOut, 
  Sparkles,
  ShoppingBag,
  ArrowLeft,
  Loader2,
  Upload,
  Image as ImageIcon,
  ZoomIn,
  Maximize2
} from 'lucide-react';

export interface Product {
  id: string;
  title: string;
  category: string; // e.g. "Injector", "Mod Menu", "Script", or custom
  downloadUrl: string;
  priceType: string; // "Free", "Paid", "Free & Paid"
  version?: string;
  iconUrl?: string;
  screenshots?: string[];
  description?: string;
  createdAt: number;
}

const DEFAULT_CATEGORIES = ['Injector', 'Mod Menu', 'Script'];

// Image compression utility converting local files to light data URLs
const compressImage = (file: File, maxDimension = 1000, quality = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = () => reject('Failed to process image');
    };
    reader.onerror = (error) => reject(error);
  });
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, filter: 'blur(15px)', scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export default function App() {
  const TELEGRAM_URL = 'https://t.me/NebulaFXsk';
  
  // Navigation State
  const [currentView, setCurrentView] = useState<'home' | 'store'>('home');
  
  // Admin State (Password: ?astral)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('astral_admin_auth') === 'true';
  });
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [adminAuthError, setAdminAuthError] = useState<string>('');

  // Products State from Firebase Firestore
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Expanded Image Lightbox State
  const [expandedImage, setExpandedImage] = useState<{ url: string; title?: string } | null>(null);

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Real-time Firestore sync for products
  useEffect(() => {
    setIsLoadingProducts(true);
    const q = collection(db, 'products');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedProducts: Product[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedProducts.push({
          id: docSnap.id,
          title: data.title || '',
          category: data.category || 'General',
          downloadUrl: data.downloadUrl || '',
          priceType: data.priceType || 'Free',
          version: data.version || undefined,
          iconUrl: data.iconUrl || undefined,
          screenshots: Array.isArray(data.screenshots) ? data.screenshots : undefined,
          description: data.description || undefined,
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
        });
      });
      // Sort newest created products first
      loadedProducts.sort((a, b) => b.createdAt - a.createdAt);
      setProducts(loadedProducts);
      setIsLoadingProducts(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setIsLoadingProducts(false);
    });

    return () => unsubscribe();
  }, []);

  // Product Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modal States for Product Publish/Edit & Detail View
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formCategorySelect, setFormCategorySelect] = useState('Injector');
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formDownloadUrl, setFormDownloadUrl] = useState('');
  const [formPriceType, setFormPriceType] = useState('Free');
  const [formVersion, setFormVersion] = useState('');
  const [formIconUrl, setFormIconUrl] = useState('');
  const [screenshotsList, setScreenshotsList] = useState<string[]>([]);
  const [formDescription, setFormDescription] = useState('');

  // Image upload status
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [isUploadingScreenshots, setIsUploadingScreenshots] = useState(false);
  const [iconMode, setIconMode] = useState<'upload' | 'url'>('upload');
  const [screenshotsMode, setScreenshotsMode] = useState<'upload' | 'url'>('upload');

  const iconFileInputRef = useRef<HTMLInputElement>(null);
  const screenshotFileInputRef = useRef<HTMLInputElement>(null);

  // Extract all unique categories dynamically
  const existingCategories = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...products.map(p => p.category)])
  );

  // Open Publish Modal
  const handleOpenPublishModal = (productToEdit?: Product) => {
    if (productToEdit) {
      setEditingProduct(productToEdit);
      setFormTitle(productToEdit.title);
      if (DEFAULT_CATEGORIES.includes(productToEdit.category)) {
        setFormCategorySelect(productToEdit.category);
        setFormCustomCategory('');
      } else {
        setFormCategorySelect('Custom');
        setFormCustomCategory(productToEdit.category);
      }
      setFormDownloadUrl(productToEdit.downloadUrl);
      setFormPriceType(productToEdit.priceType || 'Free');
      setFormVersion(productToEdit.version || '');
      setFormIconUrl(productToEdit.iconUrl || '');
      setScreenshotsList(productToEdit.screenshots || []);
      setFormDescription(productToEdit.description || '');
    } else {
      setEditingProduct(null);
      setFormTitle('');
      setFormCategorySelect('Injector');
      setFormCustomCategory('');
      setFormDownloadUrl('');
      setFormPriceType('Free');
      setFormVersion('');
      setFormIconUrl('');
      setScreenshotsList([]);
      setFormDescription('');
    }
    setShowPublishModal(true);
  };

  // Handle Icon File Upload
  const handleIconFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploadingIcon(true);
      const compressedDataUrl = await compressImage(files[0], 400, 0.85);
      setFormIconUrl(compressedDataUrl);
    } catch (err) {
      alert('Failed to process logo image. Please try another image.');
    } finally {
      setIsUploadingIcon(false);
      if (iconFileInputRef.current) iconFileInputRef.current.value = '';
    }
  };

  // Handle Screenshot Files Upload
  const handleScreenshotFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploadingScreenshots(true);
      const newImages: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i], 1000, 0.8);
        newImages.push(compressed);
      }
      setScreenshotsList(prev => [...prev, ...newImages]);
    } catch (err) {
      alert('Failed to process screenshot images. Please try again.');
    } finally {
      setIsUploadingScreenshots(false);
      if (screenshotFileInputRef.current) screenshotFileInputRef.current.value = '';
    }
  };

  // Remove Screenshot
  const handleRemoveScreenshot = (indexToRemove: number) => {
    setScreenshotsList(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Handle Admin Login Submit
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput === '?astral') {
      setIsAdminLoggedIn(true);
      localStorage.setItem('astral_admin_auth', 'true');
      setShowAdminLoginModal(false);
      setAdminPasswordInput('');
      setAdminAuthError('');
    } else {
      setAdminAuthError('Invalid Admin Password. Access Denied.');
    }
  };

  // Handle Admin Logout
  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    localStorage.removeItem('astral_admin_auth');
  };

  // Handle Save / Publish Product to Firebase Firestore
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDownloadUrl.trim()) return;

    setIsSaving(true);
    const finalCategory = formCategorySelect === 'Custom' 
      ? (formCustomCategory.trim() || 'General')
      : formCategorySelect;

    const productPayload = {
      title: formTitle.trim(),
      category: finalCategory,
      downloadUrl: formDownloadUrl.trim(),
      priceType: formPriceType,
      version: formVersion.trim() || null,
      iconUrl: formIconUrl.trim() || null,
      screenshots: screenshotsList.length > 0 ? screenshotsList : null,
      description: formDescription.trim() || null,
      createdAt: editingProduct ? editingProduct.createdAt : Date.now(),
    };

    try {
      if (editingProduct) {
        const docRef = doc(db, 'products', editingProduct.id);
        await setDoc(docRef, productPayload, { merge: true });
      } else {
        const newDocRef = doc(collection(db, 'products'));
        await setDoc(newDocRef, productPayload);
      }
      setShowPublishModal(false);
    } catch (err) {
      handleFirestoreError(err, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    } finally {
      setIsSaving(false);
    }
  };

  // Custom Delete Confirmation State
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Handle Delete Product execution from Firebase Firestore
  const confirmDeleteProduct = async () => {
    if (!deletingProduct) return;
    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'products', deletingProduct.id));
      if (viewingProduct?.id === deletingProduct.id) {
        setViewingProduct(null);
      }
      setDeletingProduct(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${deletingProduct.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Products List
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen font-['DM_Sans'] bg-[#050505] text-white selection:bg-blue-500/30 overflow-x-hidden relative">
      {/* Background Orbital Asset */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img 
          src="/public/assets/aistudio/200w__1__9c33c230.webp" 
          alt="" 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full object-cover opacity-10 mix-blend-screen scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />
      </div>

      {/* 1. Universal Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-6 px-6 py-4 md:px-12">
          {/* Zone 1: Brand Logo & Navigation */}
          <button 
            onClick={() => setCurrentView('home')} 
            className="flex items-center gap-3 shrink-0 text-left focus:outline-none group cursor-pointer"
          >
            <img 
              src="/public/assets/aistudio/IMG_20261108_104011_773_9da4fd1b.jpg" 
              alt="Astral MODZ Logo" 
              className="w-9 h-9 rounded-full object-cover border border-blue-500/20 shadow-[0_0_15px_rgba(37,99,235,0.2)] group-hover:scale-105 transition-transform cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedImage({
                  url: '/public/assets/aistudio/IMG_20261108_104011_773_9da4fd1b.jpg',
                  title: 'Astral MODZ Logo'
                });
              }}
              title="Click to expand logo"
            />
            <span className="text-xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans'] whitespace-nowrap">
              Astral MODZ
            </span>
          </button>

          {/* Zone 2: Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <button 
              onClick={() => setCurrentView('home')}
              className={`transition-colors whitespace-nowrap cursor-pointer ${currentView === 'home' ? 'text-white font-semibold' : 'hover:text-white'}`}
            >
              Home
            </button>
            <button 
              onClick={() => setCurrentView('store')}
              className={`flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${currentView === 'store' ? 'text-white font-semibold' : 'hover:text-white'}`}
            >
              <ShoppingBag className="w-4 h-4 text-blue-400" />
              Store / Apps
              {products.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] bg-blue-600 text-white rounded-full font-bold">
                  {products.length}
                </span>
              )}
            </button>
            <a href="#features" onClick={() => setCurrentView('home')} className="hover:text-white transition-colors whitespace-nowrap">Features</a>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors whitespace-nowrap">Telegram</a>
          </nav>

          {/* Zone 3: Actions (Store Link / Admin Auth) */}
          <div className="flex items-center gap-3 shrink-0">
            {isAdminLoggedIn ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-blue-950/60 border border-blue-500/30 text-blue-300 text-xs rounded-full font-semibold">
                  <Unlock className="w-3.5 h-3.5" />
                  Admin Mode
                </span>
                <button 
                  onClick={() => handleOpenPublishModal()}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-full hover:bg-blue-500 transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Publish App
                </button>
                <button 
                  onClick={handleAdminLogout}
                  title="Logout Admin"
                  className="p-2 text-slate-400 hover:text-white bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentView('store')}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-full hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Store / Download
                </button>
                <button 
                  onClick={() => { setAdminAuthError(''); setShowAdminLoginModal(true); }}
                  title="Admin Access"
                  className="p-2.5 text-slate-400 hover:text-blue-400 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-24 relative z-10">
        <AnimatePresence mode="wait">
          {currentView === 'home' ? (
            <motion.div 
              key="home-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
            >
              {/* 2. Landing Hero Section */}
              <section className="relative px-6 py-24 md:py-40 lg:py-52 max-w-[1440px] mx-auto text-center overflow-hidden">
                {/* Intense Background Glows */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[500px] bg-blue-600/15 blur-[140px] rounded-full pointer-events-none" />
                
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: false, amount: 0.1 }}
                  className="relative z-10"
                >
                  <motion.div variants={itemVariants} className="flex justify-center mb-10">
                    <div className="relative group cursor-pointer" onClick={() => setExpandedImage({ url: '/public/assets/aistudio/IMG_20261108_104011_773_9da4fd1b.jpg', title: 'Astral MODZ Hero Logo' })}>
                      <img 
                        src="/public/assets/aistudio/IMG_20261108_104011_773_9da4fd1b.jpg" 
                        alt="Astral MODZ Large Logo" 
                        className="w-36 h-36 md:w-48 md:h-48 rounded-3xl shadow-2xl shadow-blue-900/40 border border-white/5 group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Maximize2 className="w-8 h-8" />
                      </div>
                    </div>
                  </motion.div>

                  <motion.h1 
                    variants={itemVariants}
                    className="text-5xl md:text-7xl lg:text-8xl font-black font-['Plus_Jakarta_Sans'] tracking-tighter text-white mb-8 max-w-5xl mx-auto leading-[1.1]"
                  >
                    Astral Modz
                  </motion.h1>

                  <motion.p 
                    variants={itemVariants}
                    className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto mb-12 leading-relaxed font-medium"
                  >
                    Best Free & Paid service for all users who wants to improve their performance in MLBB without getting banned
                  </motion.p>

                  <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-5">
                    <button 
                      onClick={() => setCurrentView('store')}
                      className="group w-full sm:w-auto px-10 py-5 text-sm font-bold text-white bg-blue-600 rounded-full hover:bg-blue-500 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-900/40 cursor-pointer"
                    >
                      <Download className="w-5 h-5" />
                      Browse Store / Download
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <a 
                      href={TELEGRAM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto px-10 py-5 text-sm font-bold text-slate-200 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                    >
                      <ExternalLink className="w-5 h-5" />
                      Telegram Channel
                    </a>
                  </motion.div>
                </motion.div>
              </section>

              {/* 3. Features Section */}
              <section id="features" className="px-6 py-32 max-w-[1440px] mx-auto border-t border-white/5">
                <motion.div 
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: false, amount: 0.1 }}
                  variants={containerVariants}
                  className="grid grid-cols-1 md:grid-cols-3 gap-8"
                >
                  <FeatureCard 
                    icon={<Zap className="w-8 h-8 text-blue-400" />}
                    title="01: Peak Performance"
                    description="Working features that boost your performance significantly in MLBB."
                  />
                  <FeatureCard 
                    icon={<Users className="w-8 h-8 text-blue-400" />}
                    title="02: Free & Paid"
                    description="Best free service(s) also paid. We cater to every type of user."
                  />
                  <FeatureCard 
                    icon={<Shield className="w-8 h-8 text-blue-400" />}
                    title="03: Security & Privacy"
                    description="This services don't take any data or do anything with your device but only helps your performance in MLBB with our features."
                  />
                </motion.div>
              </section>

              {/* 4. Community/Telegram Section */}
              <section id="community" className="px-6 py-32 md:py-48 bg-gradient-to-b from-transparent to-blue-900/10">
                <motion.div 
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: false, amount: 0.1 }}
                  variants={containerVariants}
                  className="max-w-[1200px] mx-auto bg-[#0A0A0A] border border-blue-500/20 rounded-[3rem] p-10 md:p-24 text-center relative overflow-hidden shadow-2xl shadow-blue-900/20"
                >
                  <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full" />
                  
                  <motion.h2 variants={itemVariants} className="text-4xl md:text-6xl font-black font-['Plus_Jakarta_Sans'] text-white mb-8 tracking-tighter">
                    Join Our Telegram
                  </motion.h2>
                  <motion.p variants={itemVariants} className="text-slate-400 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
                    Access our exclusive community for instant updates, technical support, and premium MLBB features.
                  </motion.p>
                  <motion.a 
                    variants={itemVariants}
                    href={TELEGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-4 px-12 py-6 bg-white text-black font-black rounded-full hover:bg-slate-100 transition-all text-xl shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                  >
                    Visit @NebulaFXsk
                    <ExternalLink className="w-6 h-6" />
                  </motion.a>
                </motion.div>
              </section>
            </motion.div>
          ) : (
            /* STORE / CATALOG VIEW */
            <motion.div 
              key="store-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="px-6 py-12 md:py-20 max-w-[1440px] mx-auto min-h-[80vh]"
            >
              {/* Top Navigation & Breadcrumb */}
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => setCurrentView('home')}
                  className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Home
                </button>
                {isAdminLoggedIn && (
                  <button 
                    onClick={() => handleOpenPublishModal()}
                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 rounded-full hover:bg-blue-500 transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Publish New App
                  </button>
                )}
              </div>

              {/* Store Header Banner */}
              <div className="relative p-8 md:p-14 bg-gradient-to-r from-blue-950/40 via-[#0A0A0A] to-[#0A0A0A] border border-blue-500/20 rounded-[2.5rem] mb-12 overflow-hidden">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />
                <div className="relative z-10 max-w-3xl">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold mb-4">
                    <Sparkles className="w-3.5 h-3.5" />
                    Official Firebase Database Sync
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black font-['Plus_Jakarta_Sans'] text-white mb-4 tracking-tight">
                    Astral Products Store
                  </h1>
                  <p className="text-slate-400 text-base md:text-lg leading-relaxed">
                    Download verified utilities, injectors, mod menus, and scripts published directly by the Astral MODZ team.
                  </p>
                </div>
              </div>

              {/* Filters & Search Bar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-10">
                {/* Category Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                  <button 
                    onClick={() => setSelectedCategory('All')}
                    className={`px-5 py-2 text-xs font-bold rounded-full whitespace-nowrap transition-all cursor-pointer ${selectedCategory === 'All' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
                  >
                    All Services ({products.length})
                  </button>
                  {existingCategories.map(cat => {
                    const count = products.filter(p => p.category === cat).length;
                    return (
                      <button 
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-5 py-2 text-xs font-bold rounded-full whitespace-nowrap transition-all cursor-pointer ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
                      >
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Search Input */}
                <div className="relative w-full md:w-72 shrink-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Search apps or features..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-full pl-11 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Products Display Grid or Loading or Empty State */}
              {isLoadingProducts ? (
                <div className="py-24 text-center border border-white/5 rounded-[2.5rem] bg-[#0A0A0A]/50 p-8 flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                  <p className="text-slate-400 text-sm font-medium">Connecting to Firebase Database...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-24 text-center border border-white/5 rounded-[2.5rem] bg-[#0A0A0A]/50 p-8">
                  <div className="w-20 h-20 bg-blue-600/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-400">
                    <Package className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3 font-['Plus_Jakarta_Sans']">
                    {searchQuery || selectedCategory !== 'All' 
                      ? 'No services found matching filters' 
                      : 'No Products Published Yet'}
                  </h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                    {searchQuery || selectedCategory !== 'All' 
                      ? 'Try resetting your search query or selecting a different category tab.' 
                      : 'We haven\'t published any apps yet. Products published via Admin mode will automatically sync here via Firebase!'}
                  </p>
                  
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {searchQuery || selectedCategory !== 'All' ? (
                      <button 
                        onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                        className="px-6 py-3 text-xs font-bold text-white bg-blue-600 rounded-full hover:bg-blue-500 transition-all cursor-pointer"
                      >
                        Reset Search Filters
                      </button>
                    ) : (
                      <>
                        <a 
                          href={TELEGRAM_URL} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-6 py-3 text-xs font-bold text-white bg-blue-600 rounded-full hover:bg-blue-500 transition-all flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Join Telegram for Release Alerts
                        </a>
                        {isAdminLoggedIn && (
                          <button 
                            onClick={() => handleOpenPublishModal()}
                            className="px-6 py-3 text-xs font-bold text-slate-200 bg-white/10 border border-white/10 rounded-full hover:bg-white/20 transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            Publish First App (Admin)
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map(product => {
                    const iconSrc = product.iconUrl || '/public/assets/aistudio/IMG_20261108_104011_773_9da4fd1b.jpg';
                    return (
                      <motion.div 
                        key={product.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#0A0A0A] border border-white/5 hover:border-blue-500/30 rounded-[2rem] p-6 flex flex-col justify-between transition-all group relative overflow-hidden"
                      >
                        {/* Top Header Card Info */}
                        <div>
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3.5">
                              <div 
                                className="relative group/icon cursor-pointer shrink-0" 
                                onClick={() => setExpandedImage({ url: iconSrc, title: product.title + ' Logo' })}
                                title="Click to expand icon"
                              >
                                <img 
                                  src={iconSrc} 
                                  alt={product.title} 
                                  className="w-14 h-14 rounded-2xl object-cover border border-white/10 bg-blue-950/20 shadow-md group-hover/icon:scale-105 transition-transform"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/public/assets/aistudio/IMG_20261108_104011_773_9da4fd1b.jpg';
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover/icon:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <ZoomIn className="w-5 h-5" />
                                </div>
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-white font-['Plus_Jakarta_Sans'] group-hover:text-blue-400 transition-colors line-clamp-1">
                                  {product.title}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    {product.category}
                                  </span>
                                  {product.version && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {product.version}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <span className={`text-[10px] font-bold px-3 py-1 rounded-full shrink-0 ${product.priceType === 'Free' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                              {product.priceType}
                            </span>
                          </div>

                          {/* Description Preview */}
                          <p className="text-slate-400 text-xs leading-relaxed line-clamp-3 mb-6">
                            {product.description || 'No detailed description provided for this service.'}
                          </p>

                          {/* Screenshot thumbnail previews if available */}
                          {product.screenshots && product.screenshots.length > 0 && (
                            <div className="flex gap-2 mb-6 overflow-hidden rounded-xl border border-white/5">
                              {product.screenshots.slice(0, 2).map((img, idx) => (
                                <div 
                                  key={idx} 
                                  className="relative w-1/2 h-20 group/shot cursor-pointer overflow-hidden rounded-lg"
                                  onClick={() => setExpandedImage({ url: img, title: `${product.title} Screenshot ${idx + 1}` })}
                                >
                                  <img 
                                    src={img} 
                                    alt="screenshot" 
                                    className="w-full h-full object-cover opacity-80 group-hover/shot:opacity-100 group-hover/shot:scale-105 transition-all" 
                                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/shot:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <ZoomIn className="w-4 h-4" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Card Action Controls */}
                        <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-3">
                          <button 
                            onClick={() => setViewingProduct(product)}
                            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            View Details
                          </button>
                          
                          <div className="flex items-center gap-2">
                            {isAdminLoggedIn && (
                              <>
                                <button 
                                  onClick={() => handleOpenPublishModal(product)}
                                  title="Edit Product"
                                  className="p-2 text-slate-400 hover:text-blue-400 bg-white/5 hover:bg-white/10 rounded-full transition-all cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => setDeletingProduct(product)}
                                  title="Delete Product"
                                  className="p-2 text-slate-400 hover:text-red-400 bg-white/5 hover:bg-white/10 rounded-full transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <a 
                              href={product.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 rounded-full hover:bg-blue-500 transition-all flex items-center gap-1.5 shadow-md shadow-blue-900/30"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ADMIN LOGIN MODAL */}
      <AnimatePresence>
        {showAdminLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0A0A0A] border border-blue-500/30 rounded-[2rem] p-8 relative shadow-2xl shadow-blue-900/30"
            >
              <button 
                onClick={() => setShowAdminLoginModal(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 mb-6">
                <Lock className="w-6 h-6" />
              </div>

              <h3 className="text-2xl font-bold font-['Plus_Jakarta_Sans'] text-white mb-2">
                Admin Authentication
              </h3>
              <p className="text-slate-400 text-xs mb-6">
                Enter the secret master key password to access publishing and product management options.
              </p>

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Admin Password
                  </label>
                  <input 
                    type="password"
                    placeholder="Enter password..."
                    value={adminPasswordInput}
                    onChange={(e) => { setAdminPasswordInput(e.target.value); setAdminAuthError(''); }}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    autoFocus
                  />
                  {adminAuthError && (
                    <p className="text-red-400 text-xs mt-2 font-medium">
                      {adminAuthError}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowAdminLoginModal(false)}
                    className="w-1/2 py-3 text-xs font-bold text-slate-400 bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="w-1/2 py-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-900/40 cursor-pointer"
                  >
                    Authenticate
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADMIN PUBLISH / EDIT PRODUCT MODAL */}
      <AnimatePresence>
        {showPublishModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#0A0A0A] border border-blue-500/30 rounded-[2rem] p-8 relative shadow-2xl shadow-blue-900/40 my-8 max-h-[92vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowPublishModal(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-['Plus_Jakarta_Sans'] text-white">
                    {editingProduct ? 'Edit Service / App' : 'Publish New App / Service'}
                  </h3>
                  <p className="text-slate-400 text-xs">
                    Fill in the app details below to publish it live to Firebase database.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-5">
                {/* Product Name & Version */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Service / App Title *
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Astral MLBB Injector V2"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Version (Optional)
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. v2.4.1"
                      value={formVersion}
                      onChange={(e) => setFormVersion(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Category & Pricing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Service Type / Category *
                    </label>
                    <select 
                      value={formCategorySelect}
                      onChange={(e) => setFormCategorySelect(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Injector">Injector</option>
                      <option value="Mod Menu">Mod Menu</option>
                      <option value="Script">Script</option>
                      <option value="Custom">+ Create Custom Category...</option>
                    </select>

                    {formCategorySelect === 'Custom' && (
                      <input 
                        type="text"
                        required
                        placeholder="Enter custom service type..."
                        value={formCustomCategory}
                        onChange={(e) => setFormCustomCategory(e.target.value)}
                        className="w-full mt-2 bg-black border border-blue-500/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Pricing Tag
                    </label>
                    <select 
                      value={formPriceType}
                      onChange={(e) => setFormPriceType(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Free">Free</option>
                      <option value="Paid">Paid</option>
                      <option value="Free & Paid">Free & Paid</option>
                    </select>
                  </div>
                </div>

                {/* Download Link */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Download Link / Redirect URL *
                  </label>
                  <input 
                    type="url" 
                    required
                    placeholder="https://t.me/NebulaFXsk or direct download URL"
                    value={formDownloadUrl}
                    onChange={(e) => setFormDownloadUrl(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>

                {/* LOGO / ICON UPLOAD OR URL SECTION */}
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                      App Logo / Icon
                    </label>
                    <div className="flex items-center gap-1 bg-black p-1 rounded-lg border border-white/10">
                      <button 
                        type="button"
                        onClick={() => setIconMode('upload')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${iconMode === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        Upload File
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIconMode('url')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${iconMode === 'url' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        Image URL
                      </button>
                    </div>
                  </div>

                  {iconMode === 'upload' ? (
                    <div>
                      <input 
                        type="file" 
                        ref={iconFileInputRef}
                        accept="image/*"
                        onChange={handleIconFileUpload}
                        className="hidden"
                      />
                      <div 
                        onClick={() => iconFileInputRef.current?.click()}
                        className="border-2 border-dashed border-white/15 hover:border-blue-500/50 rounded-xl p-4 text-center cursor-pointer transition-colors bg-black/40 hover:bg-blue-950/20 flex flex-col items-center justify-center gap-2"
                      >
                        {isUploadingIcon ? (
                          <div className="flex items-center gap-2 text-xs text-blue-400 py-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Optimizing logo image...
                          </div>
                        ) : formIconUrl ? (
                          <div className="flex items-center gap-4">
                            <img 
                              src={formIconUrl} 
                              alt="Logo Preview" 
                              className="w-12 h-12 rounded-xl object-cover border border-white/20 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedImage({ url: formIconUrl, title: 'Uploaded Logo Preview' });
                              }}
                              title="Click to expand"
                            />
                            <div className="text-left">
                              <span className="text-xs font-semibold text-white block">Custom Logo Uploaded</span>
                              <span className="text-[10px] text-blue-400 hover:underline">Click to change file</span>
                            </div>
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFormIconUrl(''); }}
                              className="p-1.5 text-slate-400 hover:text-red-400 bg-white/10 rounded-full ml-2"
                              title="Remove Icon"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-blue-400" />
                            <span className="text-xs text-slate-300 font-medium">Click to browse and upload logo image</span>
                            <span className="text-[10px] text-slate-500">Supports PNG, JPG, WEBP</span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <input 
                      type="url" 
                      placeholder="Paste image URL (e.g. https://domain.com/logo.png)"
                      value={formIconUrl}
                      onChange={(e) => setFormIconUrl(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>

                {/* SCREENSHOTS UPLOAD OR URL SECTION */}
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                      Product Screenshots & Photos
                    </label>
                    <div className="flex items-center gap-1 bg-black p-1 rounded-lg border border-white/10">
                      <button 
                        type="button"
                        onClick={() => setScreenshotsMode('upload')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${screenshotsMode === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        Upload Files
                      </button>
                      <button 
                        type="button"
                        onClick={() => setScreenshotsMode('url')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${screenshotsMode === 'url' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        Paste URLs
                      </button>
                    </div>
                  </div>

                  {screenshotsMode === 'upload' ? (
                    <div>
                      <input 
                        type="file" 
                        ref={screenshotFileInputRef}
                        accept="image/*"
                        multiple
                        onChange={handleScreenshotFilesUpload}
                        className="hidden"
                      />
                      <div 
                        onClick={() => screenshotFileInputRef.current?.click()}
                        className="border-2 border-dashed border-white/15 hover:border-blue-500/50 rounded-xl p-4 text-center cursor-pointer transition-colors bg-black/40 hover:bg-blue-950/20 flex flex-col items-center justify-center gap-2 mb-3"
                      >
                        {isUploadingScreenshots ? (
                          <div className="flex items-center gap-2 text-xs text-blue-400 py-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Optimizing screenshot images...
                          </div>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-blue-400" />
                            <span className="text-xs text-slate-300 font-medium">Click to select 1 or multiple screenshot files</span>
                            <span className="text-[10px] text-slate-500">Supports PNG, JPG, WEBP (Batch upload allowed)</span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <textarea 
                        rows={2}
                        placeholder="Paste image URLs (one per line)..."
                        value={screenshotsList.join('\n')}
                        onChange={(e) => {
                          const urls = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
                          setScreenshotsList(urls);
                        }}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  )}

                  {/* Screenshots Preview Gallery */}
                  {screenshotsList.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                        Uploaded Screenshots ({screenshotsList.length}) - Click thumbnail to zoom
                      </span>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {screenshotsList.map((img, idx) => (
                          <div key={idx} className="relative shrink-0 group">
                            <img 
                              src={img} 
                              alt={`screenshot-${idx}`} 
                              className="w-24 h-16 object-cover rounded-lg border border-white/15 cursor-pointer group-hover:opacity-90 transition-opacity" 
                              onClick={() => setExpandedImage({ url: img, title: `Uploaded Screenshot ${idx + 1}` })}
                            />
                            <button 
                              type="button"
                              onClick={() => handleRemoveScreenshot(idx)}
                              className="absolute top-1 right-1 p-1 bg-black/80 hover:bg-red-600 text-white rounded-full opacity-80 group-hover:opacity-100 transition-opacity"
                              title="Delete screenshot"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    App Description & Features (Optional)
                  </label>
                  <textarea 
                    rows={3}
                    placeholder="Describe working features, installation instructions, or key benefits..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button 
                    type="button"
                    onClick={() => setShowPublishModal(false)}
                    className="px-6 py-2.5 text-xs font-bold text-slate-400 hover:text-white bg-white/5 rounded-full cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving || isUploadingIcon || isUploadingScreenshots}
                    className="px-8 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg shadow-blue-900/40 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingProduct ? 'Update Product' : 'Publish Service'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW PRODUCT DETAILS MODAL */}
      <AnimatePresence>
        {viewingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-[#0A0A0A] border border-blue-500/30 rounded-[2.5rem] p-8 relative shadow-2xl shadow-blue-900/40 max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setViewingProduct(null)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div 
                  className="relative group/deticon cursor-pointer shrink-0" 
                  onClick={() => setExpandedImage({
                    url: viewingProduct.iconUrl || '/public/assets/aistudio/IMG_20261108_104011_773_9da4fd1b.jpg',
                    title: viewingProduct.title + ' Logo'
                  })}
                  title="Click to expand icon"
                >
                  <img 
                    src={viewingProduct.iconUrl || '/public/assets/aistudio/IMG_20261108_104011_773_9da4fd1b.jpg'} 
                    alt={viewingProduct.title} 
                    className="w-16 h-16 rounded-2xl object-cover border border-white/10 shadow-lg group-hover/deticon:scale-105 transition-transform"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/public/assets/aistudio/IMG_20261108_104011_773_9da4fd1b.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover/deticon:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <ZoomIn className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white font-['Plus_Jakarta_Sans']">
                    {viewingProduct.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-0.5 rounded-full uppercase">
                      {viewingProduct.category}
                    </span>
                    {viewingProduct.version && (
                      <span className="text-xs text-slate-400 font-mono">
                        {viewingProduct.version}
                      </span>
                    )}
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-0.5 rounded-full">
                      {viewingProduct.priceType}
                    </span>
                  </div>
                </div>
              </div>

              {/* Screenshots Gallery */}
              {viewingProduct.screenshots && viewingProduct.screenshots.length > 0 && (
                <div className="mb-6 space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Preview Screenshots (Click to Expand)</span>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {viewingProduct.screenshots.map((img, i) => (
                      <div 
                        key={i} 
                        className="relative group/detshot cursor-pointer shrink-0 rounded-xl overflow-hidden"
                        onClick={() => setExpandedImage({ url: img, title: `${viewingProduct.title} Screenshot ${i + 1}` })}
                      >
                        <img 
                          src={img} 
                          alt="Screenshot" 
                          className="h-40 w-auto rounded-xl object-cover border border-white/10 group-hover/detshot:scale-105 transition-transform" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/detshot:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <ZoomIn className="w-6 h-6" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="mb-8">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">About this Service</span>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line bg-white/5 border border-white/5 p-4 rounded-2xl">
                  {viewingProduct.description || 'No detailed description provided.'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
                <span className="text-xs text-slate-500">
                  Published: {new Date(viewingProduct.createdAt).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-3">
                  {isAdminLoggedIn && (
                    <>
                      <button 
                        onClick={() => {
                          const prod = viewingProduct;
                          setViewingProduct(null);
                          handleOpenPublishModal(prod);
                        }}
                        className="px-4 py-2.5 text-xs font-bold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                        Edit
                      </button>
                      <button 
                        onClick={() => {
                          setDeletingProduct(viewingProduct);
                        }}
                        className="px-4 py-2.5 text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-full transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </>
                  )}
                  <a 
                    href={viewingProduct.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-full hover:bg-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/40"
                  >
                    <Download className="w-4 h-4" />
                    Download Now
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deletingProduct && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0A0A0A] border border-red-500/30 rounded-[2rem] p-8 relative shadow-2xl shadow-red-950/40 text-center"
            >
              <button 
                onClick={() => setDeletingProduct(null)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-500 mx-auto mb-5 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <Trash2 className="w-8 h-8" />
              </div>

              <h3 className="text-2xl font-bold font-['Plus_Jakarta_Sans'] text-white mb-2">
                Delete Service?
              </h3>
              <p className="text-slate-400 text-xs mb-6 leading-relaxed">
                Are you sure you want to delete <span className="text-white font-bold">{deletingProduct.title}</span>? This item will be permanently removed from the live Firebase store.
              </p>

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setDeletingProduct(null)}
                  disabled={isDeleting}
                  className="w-1/2 py-3 text-xs font-bold text-slate-300 bg-white/5 hover:bg-white/10 rounded-full transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={confirmDeleteProduct}
                  disabled={isDeleting}
                  className="w-1/2 py-3 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-full transition-all shadow-lg shadow-red-900/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FULL-SCREEN EXPANDED IMAGE LIGHTBOX MODAL */}
      <AnimatePresence>
        {expandedImage && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
            onClick={() => setExpandedImage(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center justify-center pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image Title / Header Bar */}
              {expandedImage.title && (
                <div className="mb-3 px-4 py-1.5 bg-black/70 border border-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-white tracking-wide flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  {expandedImage.title}
                </div>
              )}

              {/* Close Button */}
              <button 
                onClick={() => setExpandedImage(null)}
                className="absolute -top-12 right-0 p-2 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Full Image */}
              <img 
                src={expandedImage.url} 
                alt={expandedImage.title || 'Expanded Image'} 
                className="max-w-[90vw] max-h-[82vh] object-contain rounded-2xl border border-white/15 shadow-2xl bg-black/60"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Universal Footer */}
      <footer className="border-t border-white/5 py-16 px-6 md:px-12 bg-[#050505]">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-4">
            <img 
              src="/public/assets/aistudio/IMG_20261108_104011_773_9da4fd1b.jpg" 
              alt="Astral MODZ Logo" 
              className="w-8 h-8 rounded-full grayscale opacity-40 cursor-pointer"
              onClick={() => setExpandedImage({ url: '/public/assets/aistudio/IMG_20261108_104011_773_9da4fd1b.jpg', title: 'Astral MODZ Footer Logo' })}
              title="Click to expand logo"
            />
            <span className="text-sm font-bold tracking-widest text-slate-500 uppercase">
              © 2026 Astral MODZ
            </span>
          </div>
          
          <nav className="flex flex-wrap items-center justify-center gap-10 text-xs font-bold text-slate-500 uppercase tracking-widest">
            <button onClick={() => setCurrentView('home')} className="hover:text-white transition-colors cursor-pointer">Home</button>
            <button onClick={() => setCurrentView('store')} className="hover:text-white transition-colors cursor-pointer">Store / Apps</button>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div 
      variants={itemVariants}
      whileHover={{ scale: 1.02 }}
      className="p-10 bg-[#0A0A0A] border border-white/5 rounded-[2.5rem] hover:bg-white/[0.03] transition-all group h-full"
    >
      <div className="mb-8 p-4 bg-blue-600/10 w-fit rounded-2xl group-hover:bg-blue-600/20 transition-colors">
        {icon}
      </div>
      <h3 className="text-2xl font-bold font-['Plus_Jakarta_Sans'] text-white mb-5 tracking-tight">
        {title}
      </h3>
      <p className="text-slate-400 text-lg leading-relaxed font-medium">
        {description}
      </p>
    </motion.div>
  );
}
