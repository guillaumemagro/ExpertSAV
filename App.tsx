
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wrench, Search, Rocket, Eye, Package, ShieldCheck, 
  ImageIcon, Loader2, Ban, Database, ShoppingBag, 
  FileOutput, X, Box, Tag, Check, Square, CheckSquare,
  Sparkles, Trophy, BrainCircuit, Play, ArrowRight, Lightbulb,
  AlertTriangle, Star, Copy, CheckCircle2, Info, ChevronLeft, CheckCircle,
  ClipboardList, Printer, FileText, ListChecks, Send, MessageCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { View, DiagnosticResult, TheoryData, QuizQuestion, ChatMessage } from './types';
import { CATEGORIES, RANKS } from './constants';
import { GeminiService } from './services/geminiService';

const gemini = new GeminiService();

const WAITING_MESSAGES = [
  "Application de la matrice de prix Boulanger...",
  "Analyse de la recevabilité SAV...",
  "Optimisation du filtrage comptoir..."
];

export default function App() {
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>(View.Diagnosis);
  const [score, setScore] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [productType, setProductType] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [symptomInput, setSymptomInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const [trainingCategory, setTrainingCategory] = useState<string | null>(null);
  const [theoryData, setTheoryData] = useState<TheoryData | null>(null);
  const [isTheoryLoading, setIsTheoryLoading] = useState(false);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion & { internal_theme_tag?: string } | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
  const [loadingTime, setLoadingTime] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(new Set());
  
  // Historique pour piloter la diversité et le 80/10/10
  const [quizHistory, setQuizHistory] = useState<{ themes: string[], correctIndices: number[] }>({ themes: [], correctIndices: [] });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  const currentRank = useMemo(() => {
    return RANKS.slice().reverse().find(r => score >= r.min) || RANKS[0];
  }, [score]);

  const calculatedDifficulty = useMemo(() => {
    if (score < 300) return 'DÉBUTANT';
    if (score < 800) return 'INTERMÉDIAIRE';
    if (score < 1500) return 'AVANCÉ';
    return 'LÉGENDAIRE';
  }, [score]);

  useEffect(() => {
    gemini.fetchNFFKnowledgeBase();
  }, []);

  useEffect(() => {
    let interval: any;
    if (isAnalyzing || isTheoryLoading || isLoadingQuiz) interval = setInterval(() => setLoadingTime(prev => prev + 1), 1000);
    else setLoadingTime(0);
    return () => clearInterval(interval);
  }, [isAnalyzing, isTheoryLoading, isLoadingQuiz]);

  const toggleStep = (idx: number) => {
    const newChecked = new Set(checkedSteps);
    if (newChecked.has(idx)) newChecked.delete(idx);
    else newChecked.add(idx);
    setCheckedSteps(newChecked);
  };

  const startTraining = async (category: string) => {
    setTrainingCategory(category);
    setCurrentView(View.TrainingTheory);
    setIsTheoryLoading(true);
    setErrorMessage(null);
    setTheoryData(null);

    // Log de l'activité
    if (selectedStore) gemini.logActivity(selectedStore, 'ACADEMIE', `Théorie : ${category}`);

    try {
      const data = await gemini.generateTheory(category);
      setTheoryData(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Impossible de charger le contenu.");
      setCurrentView(View.TrainingHome);
    } finally {
      setIsTheoryLoading(false);
    }
  };

  const startQuiz = async () => {
    if (!trainingCategory) return;
    setIsLoadingQuiz(true);
    setCurrentView(View.TrainingQuiz);
    setQuizFeedback(null);
    setSelectedOptions(new Set());

    // Log de l'activité
    if (selectedStore) gemini.logActivity(selectedStore, 'ACADEMIE', `Quiz : ${trainingCategory}`);

    try {
      const q = await gemini.generateQuizQuestion(trainingCategory, calculatedDifficulty, quizHistory);
      setCurrentQuiz(q);
      // On n'ajoute à l'historique qu'après validation ou au chargement ? 
      // Mieux vaut l'ajouter ici pour que la prochaine génération sache ce qui est en cours.
      setQuizHistory(prev => ({
        themes: [...prev.themes, (q as any).internal_theme_tag || 'FILTERING'].slice(-10),
        correctIndices: [...prev.correctIndices, q.correct_indices[0]].slice(-10)
      }));
    } catch (err: any) {
      setErrorMessage("L'IA est momentanément indisponible. Réessayez dans quelques secondes.");
      setCurrentView(View.TrainingTheory);
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  const handleOptionToggle = (idx: number) => {
    if (quizFeedback) return;
    const newSelected = new Set(selectedOptions);
    if (currentQuiz?.type === 'single') {
      newSelected.clear();
      newSelected.add(idx);
    } else {
      if (newSelected.has(idx)) newSelected.delete(idx);
      else newSelected.add(idx);
    }
    setSelectedOptions(newSelected);
  };

  const validateQuiz = () => {
    if (!currentQuiz || quizFeedback) return;
    const correctIndices = currentQuiz.correct_indices.sort();
    const selectedIndices = Array.from(selectedOptions).sort();
    const isCorrect = correctIndices.length === selectedIndices.length && 
                      correctIndices.every((val, index) => val === selectedIndices[index]);
    
    setQuizFeedback({
      isCorrect,
      message: isCorrect ? "DIAGNOSTIC VALIDÉ." : "ERREUR DE FILTRAGE."
    });

    if (isCorrect) setScore(prev => prev + 50);
  };

  const handleDiagnosis = async () => {
    if (!productType || !symptomInput) return;
    setIsAnalyzing(true);
    setIsGeneratingImage(true);
    setErrorMessage(null);
    setResult(null);
    setCheckedSteps(new Set()); 
    setChatMessages([]);
    setChatInput('');
    
    // Log de l'activité
    if (selectedStore) {
      const details = `${productType} ${brand} ${model} - ${symptomInput}`.trim();
      gemini.logActivity(selectedStore, 'FILTRAGE', details);
    }

    try {
      // On lance les deux en parallèle pour gagner du temps
      // Note: Le guide visuel se base maintenant sur le symptôme pour pouvoir démarrer immédiatement
      const diagnosisPromise = gemini.performDiagnosis(productType, brand, model, symptomInput);
      const imagePromise = gemini.generateVisualGuide(`${brand} ${model}`, productType, symptomInput);

      const data = await diagnosisPromise;
      setResult(data);
      setIsAnalyzing(false);

      const imageUrl = await imagePromise;
      setResult(prev => prev ? { ...prev, visual_guide: imageUrl } : null);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur de diagnostic.");
      setIsAnalyzing(false);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || !result || isChatting) return;
    
    const userMsg = chatInput.trim();
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', text: userMsg }];
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatting(true);

    try {
      const productInfo = `${productType} ${brand} ${model}`;
      const diagnosticContext = `Cause: ${result.cause}. Résumé: ${result.professional_summary}. Focus: ${result.technical_focus}`;
      
      // Log de l'activité Chatbot
      if (selectedStore) {
        const details = `${productType} ${brand} ${model} - ${symptomInput}`.trim();
        gemini.logActivity(selectedStore, 'CHATBOT', details, userMsg);
      }

      const response = await gemini.chat(productInfo, symptomInput, diagnosticContext, newMessages);
      setChatMessages([...newMessages, { role: 'model', text: response }]);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de la discussion.");
    } finally {
      setIsChatting(false);
    }
  };

  const dynamicPhebusSummary = useMemo(() => {
    if (!result) return "";
    const actions = result.steps
      .filter((_, idx) => checkedSteps.has(idx))
      .map(s => `Action : ${s.summary_fragment}`)
      .join('\n');
    
    return `SYMPTÔME : ${result.symptom_fragment}
PROTOCOLE : ${actions || "Aucun test spécifique réalisé."}
CONSTAT : ${result.observation_fragment}`;
  }, [result, checkedSteps]);

  const handleCopyToClipboard = async () => {
    if (!dynamicPhebusSummary) return;
    try {
      await navigator.clipboard.writeText(dynamicPhebusSummary);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = dynamicPhebusSummary;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus(); textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const filteredServices = useMemo(() => {
    if (!result?.services) return [];
    return result.services.filter(s => 
      !s.name.toLowerCase().includes('infinity') && 
      !s.name.toLowerCase().includes('club')
    );
  }, [result]);

  if (!selectedStore) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#1b1d29] text-white p-6 text-center">
        <div className="bg-[#f56a00] p-4 rounded-3xl mb-8 shadow-2xl animate-pulse">
          <ShoppingBag size={48} />
        </div>
        <h1 className="text-4xl font-black font-work uppercase tracking-tighter mb-2">Expert Complice</h1>
        <p className="text-slate-400 mb-10 text-sm uppercase tracking-widest font-bold">Sélectionnez votre magasin</p>
        
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          {['F100', 'F121', 'F022', 'F528', 'F137', 'F277', 'F270'].map(store => (
            <button 
              key={store}
              onClick={() => setSelectedStore(store)}
              className="bg-white/5 hover:bg-[#f56a00] border border-white/10 hover:border-[#f56a00] text-white p-8 rounded-3xl font-black text-2xl transition-all shadow-xl flex flex-col items-center gap-3 group"
            >
              <span className="group-hover:scale-110 transition-transform">{store}</span>
              <div className="w-8 h-1 bg-white/20 rounded-full group-hover:bg-white/50"></div>
            </button>
          ))}
        </div>
        
        <p className="mt-12 text-[10px] text-slate-500 uppercase tracking-widest font-bold opacity-50">
          Propulsé par le Labo SAV Boulanger
        </p>
      </div>
    );
  }

  const renderErrorMessage = (msg: string | null) => {
    if (!msg) return null;
    let displayMsg = msg;
    try {
      // Si c'est un JSON d'erreur brut, on essaie d'extraire le message utile
      if (msg.startsWith('{')) {
        const parsed = JSON.parse(msg);
        displayMsg = parsed.error?.message || parsed.message || msg;
      }
    } catch (e) {
      // Pas un JSON, on garde le message tel quel
    }
    
    // Traduction à la volée des erreurs courantes de surcharge
    if (displayMsg.includes("high demand") || displayMsg.includes("overloaded") || displayMsg.includes("503")) {
      displayMsg = "Le moteur d'IA est actuellement très sollicité. Veuillez patienter quelques secondes avant de réessayer.";
    }

    return (
      <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3 text-red-700 font-bold text-sm">
          <AlertTriangle size={18} /> {displayMsg}
        </div>
        <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600"><X size={18} /></button>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView(View.Diagnosis)}>
          <div className="bg-[#f56a00] p-1.5 rounded-lg">
            <Rocket size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black font-work text-[#f56a00] uppercase tracking-tight leading-none">EXPERTISE</h1>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SAV BOULANGER</span>
          </div>
        </div>

        <nav className="flex bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setCurrentView(View.Diagnosis)} className={`px-5 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${currentView === View.Diagnosis ? 'bg-white shadow-sm text-[#f56a00]' : 'text-slate-400 hover:text-slate-600'}`}>Filtrage</button>
          <button onClick={() => setCurrentView(View.TrainingHome)} className={`px-5 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${currentView !== View.Diagnosis ? 'bg-white shadow-sm text-[#f56a00]' : 'text-slate-400 hover:text-slate-600'}`}>Académie</button>
        </nav>

        <div className="flex items-center gap-3">
          <div className="bg-[#1b1d29] px-3 py-2 rounded-xl text-white flex items-center gap-2 shadow-md min-w-[140px]">
            <div className="text-right w-full">
              <p className="text-[7px] font-black text-orange-400 uppercase tracking-widest leading-none mb-1">{currentRank.title}</p>
              <p className="text-xs font-black leading-none">{score} XP</p>
            </div>
            <currentRank.icon size={14} className="text-white opacity-50" />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        {renderErrorMessage(errorMessage)}

        {currentView === View.Diagnosis && (
          <div className="animate-fade-in space-y-6">
            <div className="bg-white rounded-3xl shadow-sm p-8 border border-slate-100 relative">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black font-work flex items-center gap-2 uppercase tracking-tight text-slate-800">
                  <Wrench className="text-[#f56a00]" size={22} /> Aide au Filtrage
                </h2>
                <div className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-orange-100">
                  Ne jamais ouvrir
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <input type="text" placeholder="Catégorie" className="p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-orange-200 focus:bg-white" value={productType} onChange={e => setProductType(e.target.value)} />
                <input type="text" placeholder="Marque" className="p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-orange-200 focus:bg-white" value={brand} onChange={e => setBrand(e.target.value)} />
                <input type="text" placeholder="Modèle" className="p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-orange-200 focus:bg-white" value={model} onChange={e => setModel(e.target.value)} />
                <div className="md:col-span-1 lg:col-span-2 flex gap-2">
                  <input type="text" placeholder="Symptôme constaté..." className="flex-1 p-3 bg-orange-50/50 rounded-xl text-xs font-bold outline-none border border-orange-100 focus:border-orange-300 focus:bg-white" value={symptomInput} onChange={e => setSymptomInput(e.target.value)} />
                  <button onClick={handleDiagnosis} disabled={isAnalyzing} className="bg-[#1b1d29] text-white p-3 rounded-xl hover:bg-[#f56a00] transition-all flex items-center justify-center min-w-[48px]">
                    {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-dashed border-slate-200 animate-fade-in">
                <Loader2 size={42} className="text-[#f56a00] animate-spin mb-6" />
                <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">{WAITING_MESSAGES[Math.floor(loadingTime / 2) % WAITING_MESSAGES.length]}</p>
              </div>
            ) : result && (
              <div className="grid lg:grid-cols-3 gap-6 animate-fade-in">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border-l-8 border-cyan-400">
                    <p className="text-[8px] font-black text-cyan-600 uppercase mb-2 tracking-widest flex items-center gap-1.5"><ShieldCheck size={12} /> Diagnostic Factuel</p>
                    <h3 className="font-black text-xl mb-4 text-slate-900 leading-tight">{result.cause}</h3>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-dashed border-slate-200 italic text-slate-500 text-sm leading-relaxed">
                       "{result.professional_summary}"
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-[#1b1d29] p-8 rounded-3xl text-white shadow-lg flex flex-col justify-center min-h-[280px]">
                      <h4 className="text-sm font-black uppercase mb-4 flex items-center gap-2 tracking-wide"><Eye className="text-orange-400" size={16} /> Focus Technique</h4>
                      <p className="text-slate-300 text-sm leading-relaxed font-medium">{result.technical_focus}</p>
                    </div>
                    <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center min-h-[280px] overflow-hidden">
                      {isGeneratingImage ? <Loader2 className="animate-spin text-orange-200" /> : result.visual_guide ? <img src={result.visual_guide} className="max-h-[260px] w-full object-contain rounded-2xl" /> : <ImageIcon size={32} className="text-slate-100" />}
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-3xl shadow-sm">
                    <h4 className="text-sm font-black text-slate-900 mb-6 uppercase flex items-center gap-2 tracking-tight"><ClipboardList className="text-[#f56a00]" size={18} /> Protocole Comptoir</h4>
                    <div className="space-y-3">
                      {result.steps.map((step, idx) => (
                        <div key={idx} onClick={() => toggleStep(idx)} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${checkedSteps.has(idx) ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-transparent'}`}>
                          <div className={`p-2 rounded-lg ${checkedSteps.has(idx) ? 'bg-[#f56a00] text-white' : 'bg-white text-slate-300'}`}>
                            {checkedSteps.has(idx) ? <CheckSquare size={16} /> : <Square size={16} />}
                          </div>
                          <div className="flex-1"><p className="text-[10px] font-bold text-slate-800">{step.instruction}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {result.receivability_control && (
                    <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-lg border-b-4 border-cyan-500">
                      <p className="text-[8px] font-black uppercase tracking-widest text-cyan-400 mb-2 flex items-center gap-1.5"><ShieldCheck size={10} /> Recevabilité SAV</p>
                      <h4 className="text-lg font-black mb-2">Contrôle de Recevabilité</h4>
                      <p className="text-slate-300 text-[10px] leading-relaxed font-medium">{result.receivability_control}</p>
                    </div>
                  )}

                  <div className="bg-white p-6 rounded-3xl shadow-sm border-t-4 border-orange-400">
                    <h4 className="text-xs font-black text-slate-900 mb-4 uppercase flex items-center gap-2"><ShoppingBag className="text-orange-500" size={14} /> Accessoire Requis</h4>
                    {result.accessories?.slice(0, 1).map((acc, idx) => (
                      <div key={idx} className="p-4 rounded-2xl bg-orange-50/50 border border-orange-100">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-black text-[10px] text-slate-800">{acc.name}</p>
                          <span className="text-[9px] font-black text-orange-600 bg-white px-2 py-0.5 rounded-md border border-orange-100">{acc.price}</span>
                        </div>
                        <p className="text-[9px] text-slate-500 italic leading-tight">{acc.reason}</p>
                      </div>
                    )) || <p className="text-[9px] text-slate-300 uppercase font-black text-center">Aucun accessoire recommandé</p>}
                  </div>

                  {filteredServices.length > 0 && (
                    <div className="bg-white p-6 rounded-3xl shadow-sm border-t-4 border-cyan-400">
                      <h4 className="text-xs font-black text-slate-900 mb-4 uppercase flex items-center gap-2"><Sparkles className="text-cyan-500" size={14} /> Services Additionnels</h4>
                      <div className="space-y-3">
                        {filteredServices.map((srv, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-cyan-50/30 border border-cyan-100">
                            <div className="flex justify-between items-center mb-1">
                              <p className="font-black text-[9px] text-slate-800">{srv.name}</p>
                              <span className="text-[8px] font-black text-cyan-600 bg-white px-1.5 py-0.5 rounded border border-cyan-100">{srv.price}</span>
                            </div>
                            <p className="text-[8px] text-cyan-700 italic">{srv.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={() => setShowTransferModal(true)} className="w-full py-4 bg-[#1b1d29] text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2">
                    <FileOutput size={18} /> Finaliser l'envoi SAV
                  </button>
                </div>

                {/* Chatbox Section */}
                <div className="lg:col-span-3 mt-10 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[400px]">
                  <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-orange-500 p-2 rounded-xl">
                        <MessageCircle size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-tight">Assistant Expert SAV</h4>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Approfondissement du filtrage</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[400px] bg-slate-50/50">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-4">
                        <div className="bg-white p-4 rounded-full shadow-sm text-slate-200">
                          <BrainCircuit size={48} />
                        </div>
                        <p className="text-xs font-bold text-slate-400 leading-relaxed max-w-xs">
                          Une question sur ce diagnostic ? Un doute sur une étape ? 
                          Posez votre question ici pour approfondir le filtrage.
                        </p>
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-5 rounded-3xl text-sm leading-relaxed ${
                            msg.role === 'user' 
                              ? 'bg-[#f56a00] text-white rounded-tr-none shadow-md' 
                              : 'bg-white text-slate-800 rounded-tl-none shadow-sm border border-slate-100'
                          }`}>
                            {msg.role === 'user' ? (
                              msg.text
                            ) : (
                              <div className="markdown-content prose prose-sm max-w-none">
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {isChatting && (
                      <div className="flex justify-start">
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin text-orange-500" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">L'expert réfléchit...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-white border-t border-slate-100">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Posez votre question technique ici..." 
                        className="flex-1 p-4 bg-slate-50 rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-orange-200 focus:bg-white transition-all"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleChat()}
                      />
                      <button 
                        onClick={handleChat}
                        disabled={isChatting || !chatInput.trim()}
                        className="bg-[#1b1d29] text-white p-4 rounded-2xl hover:bg-[#f56a00] transition-all disabled:opacity-50"
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {showTransferModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-fade-in border border-white/20">
              <div className="bg-[#1b1d29] p-8 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-4">
                    <FileOutput className="text-orange-400" size={28} /> Résumé de Transfert
                  </h3>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Prêt pour copie dans le dossier Phebus</p>
                </div>
                <button onClick={() => setShowTransferModal(false)} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all">
                  <X size={24} />
                </button>
              </div>
              <div className="p-10">
                <div className="bg-slate-100 p-8 rounded-3xl border-2 border-dashed border-slate-200 mb-8 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-800 max-h-[350px] overflow-y-auto shadow-inner">
                  {dynamicPhebusSummary || "Aucune étape sélectionnée."}
                </div>
                <div className="flex gap-4">
                  <button onClick={handleCopyToClipboard} className="flex-1 py-5 bg-[#f56a00] text-white rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-xl hover:bg-orange-600 transition-all flex items-center justify-center gap-3">
                    {copySuccess ? <CheckCircle size={20} /> : <Copy size={20} />}
                    {copySuccess ? "Copié avec succès" : "Copier pour Phebus"}
                  </button>
                  <button onClick={() => setShowTransferModal(false)} className="flex-1 py-5 bg-slate-200 text-slate-600 rounded-2xl font-black uppercase text-[12px] tracking-widest hover:bg-slate-300 transition-all">
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === View.TrainingHome && (
          <div className="animate-fade-in py-10 text-center space-y-10">
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Académie SAV</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => startTraining(cat.name)} className="bg-white p-8 rounded-[2rem] shadow-sm hover:border-orange-500 border border-transparent transition-all group flex flex-col items-center">
                  <span className="text-4xl block mb-3 group-hover:scale-110 transition-transform">{cat.icon}</span>
                  <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-slate-900 tracking-widest">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isTheoryLoading && (
          <div className="flex flex-col items-center justify-center p-40 bg-white rounded-[2.5rem] shadow-sm animate-fade-in border border-slate-100">
            <Loader2 size={48} className="text-orange-500 animate-spin mb-6" />
            <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Analyse technique des modules...</p>
          </div>
        )}

        {currentView === View.TrainingTheory && !isTheoryLoading && theoryData && (
          <div className="animate-fade-in space-y-6 max-w-4xl mx-auto">
            <button onClick={() => setCurrentView(View.TrainingHome)} className="flex items-center gap-2 text-slate-400 font-bold hover:text-orange-500 uppercase text-[9px] tracking-widest transition-colors">
              <ChevronLeft size={14} /> Retour à l'Académie
            </button>
            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border-t-8 border-orange-500">
              <h2 className="text-2xl font-black mb-4 text-slate-900">{theoryData.category}</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">{theoryData.intro}</p>
              <div className="grid gap-4">
                {theoryData.top_issues.map((issue, idx) => (
                  <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="font-black text-slate-800 mb-2 flex items-center gap-3"><div className="w-6 h-6 bg-orange-500 text-white rounded flex items-center justify-center text-[10px]">{idx+1}</div>{issue.issue}</h4>
                    <div className="grid md:grid-cols-2 gap-4 text-xs ml-9">
                      <div><p className="text-[7px] font-black text-slate-400 uppercase">Symptôme</p><p className="font-bold">{issue.identification}</p></div>
                      <div><p className="text-[7px] font-black text-orange-400 uppercase">Action Corrective</p><p className="font-bold text-orange-900">{issue.quick_fix}</p></div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={startQuiz} className="w-full mt-8 py-5 bg-orange-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-orange-600 transition-all flex items-center justify-center gap-3">
                Lancer l'évaluation <Play size={18} />
              </button>
            </div>
          </div>
        )}

        {currentView === View.TrainingQuiz && (
          <div className="animate-fade-in space-y-6 max-w-3xl mx-auto py-6">
            <button onClick={() => setCurrentView(View.TrainingTheory)} className="flex items-center gap-2 text-slate-400 font-bold hover:text-orange-500 uppercase text-[9px] tracking-widest transition-colors">
              <ChevronLeft size={14} /> Revenir au cours
            </button>

            {isLoadingQuiz ? (
              <div className="flex flex-col items-center justify-center p-40 bg-white rounded-[2.5rem] shadow-sm animate-fade-in">
                <BrainCircuit size={48} className="text-orange-500 animate-bounce mb-6" />
                <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Génération d'un cas expert unique...</p>
              </div>
            ) : currentQuiz ? (
              <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border-b-8 border-slate-900 relative">
                <div className="absolute top-8 right-10 flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  <Trophy size={14} /> Gain : +50 XP
                </div>
                
                <div className="flex flex-col gap-6 mb-10">
                  <div className="inline-flex bg-orange-50 text-orange-600 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-orange-100 w-fit">
                    NIVEAU : {currentQuiz.difficulty}
                  </div>
                  <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                    <Sparkles className="absolute top-4 right-4 text-orange-500 opacity-20" size={64} />
                    <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <ClipboardList size={12} /> Cas Pratique Comptoir
                    </p>
                    <p className="text-sm italic leading-relaxed font-medium">"{currentQuiz.scenario}"</p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{currentQuiz.question}</h3>
                  </div>
                </div>

                <div className="grid gap-3 mb-10">
                  {currentQuiz.options.map((opt, idx) => {
                    const isSelected = selectedOptions.has(idx);
                    const isCorrect = currentQuiz.correct_indices.includes(idx);
                    
                    let style = 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200';
                    if (quizFeedback) {
                      if (isCorrect) style = 'border-green-500 bg-green-50 text-green-900 ring-4 ring-green-100 shadow-md';
                      else if (isSelected && !isCorrect) style = 'border-red-500 bg-red-50 text-red-900';
                      else style = 'border-slate-100 bg-slate-50 text-slate-400 opacity-60';
                    } else if (isSelected) {
                      style = 'border-[#1b1d29] bg-slate-100 text-[#1b1d29]';
                    }

                    return (
                      <button 
                        key={idx} 
                        onClick={() => handleOptionToggle(idx)}
                        disabled={!!quizFeedback}
                        className={`w-full p-6 rounded-3xl border-2 text-left font-bold text-xs transition-all flex items-center gap-4 ${style}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-[#1b1d29] text-white' : 'bg-white text-slate-300'
                        } ${quizFeedback && isCorrect ? 'bg-green-500 text-white' : ''} ${quizFeedback && isSelected && !isCorrect ? 'bg-red-500 text-white' : ''}`}>
                          {quizFeedback && isCorrect ? <Check size={16} /> : quizFeedback && isSelected && !isCorrect ? <X size={16} /> : String.fromCharCode(65 + idx)}
                        </div>
                        <span className="flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {!quizFeedback ? (
                  <button 
                    onClick={validateQuiz}
                    disabled={selectedOptions.size === 0}
                    className="w-full py-5 bg-[#1b1d29] text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-xl hover:bg-black disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                  >
                    Valider mon diagnostic <Check size={20} />
                  </button>
                ) : (
                  <div className="animate-fade-in border-t border-slate-100 pt-10">
                    <div className="flex flex-col items-center text-center">
                      <div className={`${quizFeedback.isCorrect ? 'text-green-500' : 'text-[#d32f2f]'} mb-6`}>
                        {quizFeedback.isCorrect ? <CheckCircle2 size={96} /> : <AlertTriangle size={96} />}
                      </div>
                      <h4 className={`text-3xl font-black uppercase tracking-tight mb-6 ${quizFeedback.isCorrect ? 'text-green-800' : 'text-[#d32f2f]'}`}>
                        {quizFeedback.message}
                      </h4>
                      <div className="bg-slate-100 p-8 rounded-[2rem] border border-slate-200 mb-10 w-full text-left italic leading-relaxed text-sm text-slate-700 font-medium font-sans shadow-inner">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-200 pb-2">Leçon de l'Expert Technique</p>
                        {currentQuiz.explanation}
                      </div>
                      <div className="flex gap-4 w-full">
                        <button 
                          onClick={startQuiz} 
                          className="flex-1 py-5 bg-[#1b1d29] text-white rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-xl hover:bg-black transition-all"
                        >
                          Scénario Suivant
                        </button>
                        <button 
                          onClick={() => setCurrentView(View.TrainingHome)} 
                          className="flex-1 py-5 bg-white border-2 border-slate-100 rounded-2xl font-black uppercase text-[12px] tracking-widest text-slate-400 hover:text-slate-600 hover:border-slate-200 transition-all"
                        >
                          Quitter l'Académie
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
