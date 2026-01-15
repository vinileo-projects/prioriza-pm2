import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  doc, updateDoc, arrayUnion, setDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  BarChart3, Upload, CheckCircle2, Sliders, Play, 
  Users, Target, ArrowRight, LayoutDashboard, Database,
  AlertCircle, X, ExternalLink, Activity, KeyRound,
  Edit2, Save, Filter
} from 'lucide-react';

// --- Fonts & Styles ---
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=DM+Sans:opsz,wght@9..40,100..1000&display=swap');
    
    :root {
      font-family: 'DM Sans', sans-serif;
      line-height: 1.5;
      font-weight: 400;
    }

    body {
      margin: 0 !important;
      padding: 0 !important;
      display: block !important; 
      place-items: unset !important; 
      min-width: 100vw !important;
      min-height: 100vh !important;
      background-color: #f8f9fa;
    }

    #root {
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
      text-align: left !important;
      width: 100%;
    }
    
    h1, h2, h3, h4, h5, h6, .font-display {
      font-family: 'Bricolage Grotesque', sans-serif;
    }

    ::-webkit-scrollbar {
      width: 8px;
    }
    ::-webkit-scrollbar-track {
      background: #f1f1f1; 
    }
    ::-webkit-scrollbar-thumb {
      background: #8d7041; 
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #09247c; 
    }
  `}</style>
);

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyA8yzP_K7eifW-kfB08ca9G_l6fUflV8DQ",
  authDomain: "prioriza-pm.firebaseapp.com",
  projectId: "prioriza-pm",
  storageBucket: "prioriza-pm.firebasestorage.app",
  messagingSenderId: "212753563965",
  appId: "1:212753563965:web:32e5827854613f7b558554",
  measurementId: "G-G5Q6FVDTXQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Types & Interfaces ---

type Team = 'OPS' | 'Product Marketing' | 'Produtos' | 'BizDev' | 'Diretoria';
type Priority = 'Alta' | 'Média' | 'Baixa';

interface Vote {
  userId: string;
  userName: string;
  userTeam: Team;
  impact: number;
  complexity: number;
  timestamp: number;
}

interface Initiative {
  id: string;
  team: string;
  metric: string;
  objective: string;
  keyResult: string;
  priority: Priority;
  name: string;
  description?: string;
  votes: Vote[];
}

interface User {
  uid: string;
  name: string;
  team: Team;
}

// --- Utilities ---

const TEAMS: Team[] = ['OPS', 'Product Marketing', 'Produtos', 'BizDev', 'Diretoria'];

const PRIORITY_ORDER: Record<string, number> = {
  'Alta': 3,
  'Média': 2,
  'Baixa': 1,
  'High': 3,
  'Medium': 2,
  'Low': 1
};

const normalizePriority = (p: string): Priority => {
  const norm = p.trim();
  if (['Alta', 'High'].includes(norm)) return 'Alta';
  if (['Média', 'Medium'].includes(norm)) return 'Média';
  return 'Baixa';
};

// --- Components ---

// 0. Initiative Detail Modal (NOVO: Card Detalhado + Edição de Voto)
const InitiativeModal = ({ 
  initiative, 
  user, 
  onClose, 
  onVote 
}: { 
  initiative: Initiative, 
  user: User, 
  onClose: () => void, 
  onVote: (id: string, impact: number, complexity: number) => void 
}) => {
  const userVote = initiative.votes.find(v => v.userId === user.uid);
  const [isEditing, setIsEditing] = useState(false);
  const [impact, setImpact] = useState(userVote?.impact || 50);
  const [complexity, setComplexity] = useState(userVote?.complexity || 50);

  const isDiretoria = user.team === 'Diretoria';
  const isTeamOwner = user.team === initiative.team;

  const handleSave = () => {
    onVote(initiative.id, impact, complexity);
    setIsEditing(false);
    // Não fecha o modal automaticamente para dar feedback visual, 
    // mas o usuário pode ver o voto atualizado.
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09247c]/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
          <div>
            <div className="flex gap-2 mb-2">
              <span className="px-2 py-1 bg-[#09247c]/10 text-[#09247c] rounded text-xs font-bold uppercase">{initiative.team}</span>
              <span className={`px-2 py-1 rounded text-xs font-bold border uppercase
                ${initiative.priority === 'Alta' ? 'bg-red-50 text-red-700 border-red-200' : 
                  initiative.priority === 'Média' ? 'bg-[#ffce00]/20 text-[#8d7041] border-[#ffce00]/40' : 
                  'bg-green-50 text-green-700 border-green-200'}`}>
                {initiative.priority}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[#09247c] font-display leading-tight">{initiative.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-[#8d7041] transition">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="bg-[#f8f9fa] p-4 rounded-xl border-l-4 border-[#ffce00]">
            <span className="block text-xs font-bold text-[#8d7041] uppercase mb-1 tracking-wider">Objetivo</span>
            <p className="font-medium text-[#09247c] text-lg">{initiative.objective}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#f8f9fa] p-4 rounded-xl border border-slate-100">
              <span className="block text-xs font-bold text-[#8d7041] uppercase mb-1 tracking-wider">Key Result</span>
              <p className="font-medium text-[#09247c]">{initiative.keyResult}</p>
            </div>
            <div className="bg-[#f8f9fa] p-4 rounded-xl border border-slate-100">
              <span className="block text-xs font-bold text-[#8d7041] uppercase mb-1 tracking-wider">Métrica</span>
              <p className="font-medium text-[#09247c]">{initiative.metric}</p>
            </div>
          </div>
        </div>

        {/* Voting Footer */}
        <div className="p-6 bg-[#f4f6f8] border-t border-slate-200">
          {!userVote && !isEditing ? (
            <div className="text-center">
              <p className="text-[#8d7041] mb-4 font-medium">Você ainda não avaliou esta iniciativa.</p>
              <button 
                onClick={() => setIsEditing(true)}
                className="w-full bg-[#ffce00] text-[#09247c] py-3 rounded-xl font-bold shadow-md hover:bg-[#e6b800] transition flex items-center justify-center gap-2"
              >
                Avaliar Agora <Play size={18} fill="currentColor"/>
              </button>
            </div>
          ) : !isEditing ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-bold text-[#09247c] uppercase flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-500"/> Seu Voto Registrado
                </span>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="text-sm text-[#09247c] font-bold underline hover:text-[#ffce00] flex items-center gap-1"
                >
                  <Edit2 size={14}/> Alterar Voto
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                  <span className="text-xs text-[#8d7041] uppercase font-bold">Impacto</span>
                  <div className="text-xl font-bold text-[#09247c]">{userVote?.impact}</div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-center">
                  <span className="text-xs text-[#8d7041] uppercase font-bold">Complexidade</span>
                  <div className="text-xl font-bold text-[#09247c]">{userVote?.complexity}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="font-bold text-[#09247c] text-sm flex items-center gap-2">
                    <Target size={16} /> Impacto
                  </label>
                  <span className="font-mono font-bold text-[#09247c]">{impact}</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={impact} onChange={(e) => setImpact(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#ffce00]"
                />
                {isDiretoria && <p className="text-[10px] text-[#8d7041] font-bold mt-1">Peso x2 (Diretoria)</p>}
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="font-bold text-[#09247c] text-sm flex items-center gap-2">
                    <Sliders size={16} /> Complexidade
                  </label>
                  <span className="font-mono font-bold text-[#09247c]">{complexity}</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={complexity} onChange={(e) => setComplexity(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#8d7041]"
                />
                {isTeamOwner && <p className="text-[10px] text-[#8d7041] font-bold mt-1">Peso x2 ({user.team})</p>}
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 bg-white border border-slate-300 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 bg-[#09247c] text-white py-3 rounded-xl font-bold shadow-md hover:bg-[#061854] transition flex items-center justify-center gap-2"
                >
                  Salvar <Save size={18}/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 0. Session Entry Component
const SessionEntry = ({ onJoinSession }: { onJoinSession: (sessionId: string) => void }) => {
  const [sessionId, setSessionId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = sessionId.trim().replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    if (cleanId) onJoinSession(cleanId);
  };

  return (
    <div className="min-h-screen bg-[#09247c] flex items-center justify-center p-4 relative overflow-hidden">
      <GlobalStyles />
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#ffce00] opacity-10 rounded-full transform translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#8d7041] opacity-20 rounded-full transform -translate-x-1/2 translate-y-1/2 blur-3xl"></div>

      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative z-10">
        <div className="flex justify-center mb-6">
          <div className="bg-[#f8f9fa] p-4 rounded-full shadow-inner">
            <KeyRound className="text-[#09247c] w-10 h-10" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-[#09247c] mb-2 font-display">Bem-vindo</h1>
        <p className="text-center text-[#8d7041] mb-8 font-medium">Digite o ID da sessão para começar ou crie um novo.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-[#09247c] mb-1">ID da Sessão</label>
            <input 
              type="text" 
              required
              className="w-full p-4 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-[#ffce00] outline-none transition text-[#09247c] font-bold text-lg text-center tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal placeholder:font-normal"
              placeholder="Ex: planning-q1"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-2 text-center">Compartilhe este mesmo ID com seu time.</p>
          </div>

          <button 
            type="submit"
            className="w-full bg-[#ffce00] hover:bg-[#e6b800] text-[#09247c] font-bold py-4 rounded-xl transition-transform active:scale-[0.98] duration-200 flex items-center justify-center gap-2 shadow-[0_4px_0_#b89500] hover:shadow-[0_2px_0_#b89500] hover:translate-y-[2px]"
          >
            Acessar Sessão <ArrowRight size={20} strokeWidth={3} />
          </button>
        </form>
      </div>
    </div>
  );
};

// 1. Login Component
const Login = ({ sessionId, onLogin }: { sessionId: string, onLogin: (name: string, team: Team) => void }) => {
  const [name, setName] = useState('');
  const [team, setTeam] = useState<Team>('Produtos');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onLogin(name, team);
  };

  return (
    <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center p-4">
      <GlobalStyles />
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border-t-4 border-[#ffce00]">
        <div className="flex justify-center mb-6">
          <div className="bg-[#09247c] p-3 rounded-xl shadow-lg shadow-blue-900/20">
            <BarChart3 className="text-[#ffce00] w-8 h-8" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-[#09247c] mb-2 font-display">PriorizaPM</h1>
        <p className="text-center text-[#8d7041] mb-2 font-medium">Sessão: <span className="font-bold bg-[#ffce00]/20 px-2 py-0.5 rounded text-[#09247c]">{sessionId}</span></p>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div>
            <label className="block text-sm font-bold text-[#09247c] mb-1">Seu Nome</label>
            <input 
              type="text" 
              required
              className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#ffce00] focus:border-[#ffce00] outline-none transition text-[#09247c] font-medium"
              placeholder="Ex: Ana Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-[#09247c] mb-1">Seu Time</label>
            <select 
              className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#ffce00] focus:border-[#ffce00] outline-none bg-white text-[#09247c] font-medium"
              value={team}
              onChange={(e) => setTeam(e.target.value as Team)}
            >
              {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <button 
            type="submit"
            className="w-full bg-[#ffce00] hover:bg-[#e6b800] text-[#09247c] font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform active:scale-[0.98] duration-200"
          >
            Entrar <ArrowRight size={18} strokeWidth={3} />
          </button>
        </form>
      </div>
    </div>
  );
};

// 2. Dashboard Component
const Dashboard = ({ 
  user, 
  sessionId,
  initiatives, 
  onStartVoting, 
  onViewMatrix,
  onUploadCSV,
  onVote
}: { 
  user: User, 
  sessionId: string,
  initiatives: Initiative[], 
  onStartVoting: () => void, 
  onViewMatrix: () => void,
  onUploadCSV: (data: any[]) => void,
  onVote: (id: string, impact: number, complexity: number) => void
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null);

  const stats = useMemo(() => {
    return {
      total: initiatives.length,
      byPriority: {
        Alta: initiatives.filter(i => i.priority === 'Alta').length,
        Media: initiatives.filter(i => i.priority === 'Média').length,
        Baixa: initiatives.filter(i => i.priority === 'Baixa').length,
      },
      byTeam: initiatives.reduce((acc, curr) => {
        acc[curr.team] = (acc[curr.team] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      myPendingVotes: initiatives.filter(i => !i.votes.some(v => v.userId === user.uid)).length
    };
  }, [initiatives, user]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      
      if (lines.length < 2) {
        alert("O arquivo parece vazio ou sem cabeçalho.");
        return;
      }
      
      const headerLine = lines[0];
      const delimiter = headerLine.includes(';') ? ';' : ',';

      const parseCSVLine = (line: string) => {
        const values: string[] = [];
        let current = '';
        let insideQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (insideQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              insideQuotes = !insideQuotes;
            }
          } else if (char === delimiter && !insideQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        return values;
      };
      
      const parsedData = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        return {
          team: values[0] || 'Geral',
          metric: values[1] || 'N/A',
          objective: values[2] || 'N/A',
          keyResult: values[3] || 'N/A',
          priority: normalizePriority(values[4] || 'Baixa'),
          name: values[5] || 'Iniciativa sem nome',
          description: values[5] || '', 
          votes: []
        };
      });
      
      if (confirm(`Carregar ${parsedData.length} iniciativas na sessão "${sessionId}"? Isso limpará as antigas.`)) {
        onUploadCSV(parsedData);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-12">
      <GlobalStyles />
      {/* Top Bar Decoration */}
      <div className="h-2 w-full bg-[#09247c]"></div>
      
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#8d7041] uppercase tracking-wider bg-white border border-[#8d7041]/20 px-2 py-1 rounded">Sessão: {sessionId}</span>
            </div>
            <h1 className="text-4xl font-bold text-[#09247c] font-display tracking-tight">Olá, {user.name}</h1>
            <p className="text-[#8d7041] font-medium">Time: <span className="font-bold px-2 py-0.5 bg-[#ffce00]/20 rounded text-[#09247c]">{user.team}</span></p>
          </div>
          <div className="flex gap-3">
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-white border-2 border-[#8d7041]/20 text-[#8d7041] px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#8d7041]/10 transition font-bold"
            >
              <Upload size={18} /> Upload CSV
            </button>
            <button 
               onClick={onViewMatrix}
               className="bg-[#09247c] hover:bg-[#061854] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition font-bold shadow-lg shadow-[#09247c]/20"
            >
               <LayoutDashboard size={18} /> Ver Matriz
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[#09247c]/10 rounded-lg text-[#09247c]"><Target size={20} /></div>
              <span className="text-sm font-bold text-[#8d7041] uppercase tracking-wider">Total Iniciativas</span>
            </div>
            <p className="text-3xl font-bold text-[#09247c] font-display">{stats.total}</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[#ffce00]/20 rounded-lg text-[#b89500]"><AlertCircle size={20} /></div>
              <span className="text-sm font-bold text-[#8d7041] uppercase tracking-wider">Alta Prioridade</span>
            </div>
            <p className="text-3xl font-bold text-[#09247c] font-display">{stats.byPriority.Alta}</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[#8d7041]/10 rounded-lg text-[#8d7041]"><Users size={20} /></div>
              <span className="text-sm font-bold text-[#8d7041] uppercase tracking-wider">Times</span>
            </div>
            <p className="text-3xl font-bold text-[#09247c] font-display">{Object.keys(stats.byTeam).length}</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#ffce00] opacity-10 rounded-bl-full"></div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[#09247c] rounded-lg text-[#ffce00]"><Activity size={20} /></div>
              <span className="text-sm font-bold text-[#8d7041] uppercase tracking-wider">Pendentes</span>
            </div>
            <p className="text-3xl font-bold text-[#09247c] font-display">{stats.myPendingVotes}</p>
            <p className="text-xs text-[#8d7041]/60 mt-1 font-medium">Sua contribuição</p>
          </div>
        </div>

        {/* Action Area */}
        <div className="bg-[#09247c] rounded-2xl p-8 text-white shadow-2xl shadow-[#09247c]/30 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#ffce00] opacity-10 rounded-full transform translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
          
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-2 text-white font-display">Hora da Dinâmica!</h2>
            <p className="text-blue-100 max-w-xl text-lg">
              Classifique as iniciativas baseando-se em Impacto e Complexidade.
              <br/>
              <span className="text-[#ffce00] text-sm font-bold mt-2 inline-block">ATENÇÃO: Pesos calibrados automaticamente.</span>
            </p>
          </div>
          <button 
            onClick={onStartVoting}
            disabled={stats.myPendingVotes === 0}
            className="relative z-10 bg-[#ffce00] text-[#09247c] px-8 py-4 rounded-xl font-bold text-lg shadow-[0_4px_0_rgb(141,112,65)] hover:shadow-[0_2px_0_rgb(141,112,65)] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 disabled:shadow-none disabled:translate-y-0"
          >
            {stats.myPendingVotes > 0 ? (
              <>Começar Priorização <Play size={20} fill="currentColor" /></>
            ) : (
              <>Tudo Votado <CheckCircle2 size={20} /></>
            )}
          </button>
        </div>

        {/* Mini List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-[#09247c]">
            Resumo das Iniciativas (Clique para detalhes)
          </div>
          <div className="max-h-64 overflow-y-auto">
            {initiatives.length === 0 ? (
              <div className="p-8 text-center text-[#8d7041]">Nenhuma iniciativa carregada. Faça upload do CSV.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-[#8d7041] uppercase bg-slate-50 sticky top-0 font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Iniciativa</th>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3">Prio Origem</th>
                    <th className="px-6 py-3 text-center">Seu Impacto</th>
                    <th className="px-6 py-3 text-center">Sua Complexidade</th>
                    <th className="px-6 py-3 text-center">Votos</th>
                  </tr>
                </thead>
                <tbody>
                  {initiatives.map((i) => {
                    const myVote = i.votes.find(v => v.userId === user.uid);
                    return (
                      <tr 
                        key={i.id} 
                        onClick={() => setSelectedInitiative(i)}
                        className="border-b border-slate-100 hover:bg-[#ffce00]/10 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-3 font-bold text-[#09247c]">{i.name}</td>
                        <td className="px-6 py-3"><span className="px-2 py-1 bg-[#09247c]/10 text-[#09247c] rounded text-xs font-bold">{i.team}</span></td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold border
                            ${i.priority === 'Alta' ? 'bg-red-50 text-red-700 border-red-200' : 
                              i.priority === 'Média' ? 'bg-[#ffce00]/20 text-[#8d7041] border-[#ffce00]/40' : 
                              'bg-green-50 text-green-700 border-green-200'}`}>
                            {i.priority}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center font-bold text-[#09247c]">
                          {myVote ? myVote.impact : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-6 py-3 text-center font-bold text-[#09247c]">
                          {myVote ? myVote.complexity : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-6 py-3 text-center text-[#8d7041] font-medium">{i.votes.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Modal */}
        {selectedInitiative && (
          <InitiativeModal 
            initiative={selectedInitiative}
            user={user}
            onClose={() => setSelectedInitiative(null)}
            onVote={onVote}
          />
        )}
      </div>
    </div>
  );
};

// 3. Voting Component
const VotingSession = ({ 
  user, 
  initiatives, 
  onVote, 
  onExit 
}: { 
  user: User, 
  initiatives: Initiative[], 
  onVote: (initiativeId: string, impact: number, complexity: number) => void,
  onExit: () => void
}) => {
  // Sort logic: High Prio -> Med -> Low, then Team Alphabetic
  const queue = useMemo(() => {
    return initiatives
      .filter(i => !i.votes.some(v => v.userId === user.uid))
      .sort((a, b) => {
        const prioDiff = (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
        if (prioDiff !== 0) return prioDiff;
        return a.team.localeCompare(b.team);
      });
  }, [initiatives, user]);

  const [impact, setImpact] = useState(50);
  const [complexity, setComplexity] = useState(50);

  const currentItem = queue[0];

  useEffect(() => {
    setImpact(50);
    setComplexity(50);
  }, [currentItem?.id]); // FIX: Só reseta se o ID mudar, não se o objeto for recriado

  const handleSubmitVote = () => {
    if (!currentItem) return;
    onVote(currentItem.id, impact, complexity);
  };

  if (!currentItem) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fa] p-6">
        <GlobalStyles />
        <div className="bg-white p-12 rounded-2xl shadow-xl text-center max-w-lg border-t-8 border-[#ffce00]">
          <div className="w-20 h-20 bg-[#09247c] text-[#ffce00] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-3xl font-bold text-[#09247c] mb-2 font-display">Parabéns!</h2>
          <p className="text-[#8d7041] mb-8 text-lg">Você classificou todas as iniciativas disponíveis.</p>
          <button onClick={onExit} className="w-full bg-[#09247c] text-white py-4 rounded-xl font-bold hover:bg-[#061854] transition shadow-lg">
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isDiretoria = user.team === 'Diretoria';
  const isTeamOwner = user.team === currentItem.team;

  return (
    <div className="min-h-screen bg-[#f4f6f8] p-4 md:p-8 flex flex-col">
      <GlobalStyles />
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={onExit} className="text-[#8d7041] hover:text-[#09247c] flex items-center gap-2 font-bold transition">
            <X size={20} /> Cancelar
          </button>
          <div className="text-sm font-bold text-[#09247c] bg-white px-4 py-2 rounded-full shadow-sm">
            {queue.length} restantes
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row flex-1 min-h-[500px] border border-slate-100">
          
          {/* Info Side */}
          <div className="md:w-1/2 p-10 border-r border-slate-100 flex flex-col relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-[#ffce00] opacity-5 rounded-br-full pointer-events-none"></div>
            
            <div className="mb-6 relative z-10">
              <div className="flex gap-2 mb-4">
                <span className="px-3 py-1 bg-[#09247c] text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm">{currentItem.team}</span>
                <span className="px-3 py-1 bg-[#ffce00] text-[#09247c] rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm">{currentItem.priority}</span>
              </div>
              <h2 className="text-4xl font-bold text-[#09247c] leading-tight mb-6 font-display">{currentItem.name}</h2>
              
              <div className="space-y-4 text-sm text-[#09247c]">
                <div className="bg-[#f8f9fa] p-5 rounded-xl border-l-4 border-[#ffce00]">
                  <span className="block text-xs font-bold text-[#8d7041] uppercase mb-1 tracking-wider">Objetivo</span>
                  <p className="font-medium text-lg leading-snug">{currentItem.objective}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#f8f9fa] p-4 rounded-xl border-l-4 border-[#8d7041]">
                    <span className="block text-xs font-bold text-[#8d7041] uppercase mb-1 tracking-wider">Key Result</span>
                    <p className="font-medium">{currentItem.keyResult}</p>
                  </div>
                  <div className="bg-[#f8f9fa] p-4 rounded-xl border-l-4 border-[#09247c]">
                    <span className="block text-xs font-bold text-[#8d7041] uppercase mb-1 tracking-wider">Métrica</span>
                    <p className="font-medium">{currentItem.metric}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Voting Side */}
          <div className="md:w-1/2 p-10 bg-[#09247c] flex flex-col justify-center text-white relative">
            
            <div className="mb-10">
              <div className="flex justify-between mb-4">
                <label className="font-bold text-[#ffce00] flex items-center gap-2 text-lg">
                  <Target size={24} /> Impacto no Negócio
                </label>
                <span className="font-mono font-bold text-white text-2xl">{impact}</span>
              </div>
              <input 
                type="range" 
                min="0" max="100" 
                value={impact} 
                onChange={(e) => setImpact(Number(e.target.value))}
                className="w-full h-4 bg-[#061854] rounded-lg appearance-none cursor-pointer accent-[#ffce00]"
              />
              {isDiretoria && (
                <p className="text-xs text-[#ffce00] mt-2 font-bold flex items-center gap-1 bg-[#ffce00]/10 p-2 rounded">
                  <CheckCircle2 size={12}/> PESO x2 (DIRETORIA)
                </p>
              )}
            </div>

            <div className="mb-12">
              <div className="flex justify-between mb-4">
                <label className="font-bold text-[#8d7041] flex items-center gap-2 text-lg text-white">
                  <Sliders size={24} className="text-[#8d7041]" /> Complexidade
                </label>
                <span className="font-mono font-bold text-white text-2xl">{complexity}</span>
              </div>
              <input 
                type="range" 
                min="0" max="100" 
                value={complexity} 
                onChange={(e) => setComplexity(Number(e.target.value))}
                className="w-full h-4 bg-[#061854] rounded-lg appearance-none cursor-pointer accent-[#8d7041]"
              />
              {isTeamOwner && (
                <p className="text-xs text-[#8d7041] mt-2 font-bold flex items-center gap-1 bg-[#8d7041]/20 p-2 rounded">
                  <CheckCircle2 size={12}/> PESO x2 ({user.team})
                </p>
              )}
            </div>

            <button 
              onClick={handleSubmitVote}
              className="w-full bg-[#ffce00] hover:bg-[#e6b800] text-[#09247c] py-5 rounded-2xl font-bold text-xl shadow-[0_4px_0_#b89500] hover:shadow-[0_2px_0_#b89500] hover:translate-y-[2px] transition-all active:shadow-none active:translate-y-[4px]"
            >
              Confirmar Voto
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};

// 4. Matrix Result Component
const MatrixResult = ({ 
  initiatives, 
  onBack 
}: { 
  initiatives: Initiative[], 
  onBack: () => void 
}) => {
  const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null);
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // Calculate Weighted Scores
  const plottedData = useMemo(() => {
    return initiatives.map(init => {
      let totalImpact = 0;
      let totalComplexity = 0;
      let impactWeightSum = 0;
      let complexityWeightSum = 0;

      if (init.votes.length === 0) return null;

      init.votes.forEach(v => {
        const wImpact = v.userTeam === 'Diretoria' ? 2 : 1;
        totalImpact += v.impact * wImpact;
        impactWeightSum += wImpact;

        const wComplexity = v.userTeam === init.team ? 2 : 1;
        totalComplexity += v.complexity * wComplexity;
        complexityWeightSum += wComplexity;
      });

      return {
        ...init,
        avgImpact: totalImpact / impactWeightSum,
        avgComplexity: totalComplexity / complexityWeightSum
      };
    }).filter(Boolean) as (Initiative & { avgImpact: number, avgComplexity: number })[];
  }, [initiatives]);

  // Aplicar Filtros
  const filteredData = useMemo(() => {
    return plottedData.filter(item => {
      const matchTeam = filterTeam === 'all' || item.team === filterTeam;
      const matchPriority = filterPriority === 'all' || item.priority === filterPriority;
      return matchTeam && matchPriority;
    });
  }, [plottedData, filterTeam, filterPriority]);

  return (
    <div className="h-screen flex flex-col bg-[#f8f9fa] overflow-hidden">
      <GlobalStyles />
      {/* Header */}
      <div className="bg-[#09247c] px-6 py-4 flex flex-col md:flex-row justify-between items-center shadow-md z-10 text-white gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
           <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition">
             <ArrowRight className="rotate-180 text-[#ffce00]" />
           </button>
           <div>
             <h1 className="text-xl font-bold font-display">Matriz Esforço x Impacto</h1>
             <div className="text-xs text-[#ffce00]/80">
               {filteredData.length} de {plottedData.length} iniciativas
             </div>
           </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative">
            <select 
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="appearance-none bg-[#061854] border border-[#09247c] text-white text-sm rounded-lg focus:ring-[#ffce00] focus:border-[#ffce00] block w-full p-2.5 pr-8 cursor-pointer"
            >
              <option value="all">Todos os Times</option>
              {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <Filter size={14} className="absolute right-3 top-3 text-[#ffce00] pointer-events-none" />
          </div>

          <div className="relative">
            <select 
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="appearance-none bg-[#061854] border border-[#09247c] text-white text-sm rounded-lg focus:ring-[#ffce00] focus:border-[#ffce00] block w-full p-2.5 pr-8 cursor-pointer"
            >
              <option value="all">Todas Prioridades</option>
              <option value="Alta">Alta</option>
              <option value="Média">Média</option>
              <option value="Baixa">Baixa</option>
            </select>
            <Filter size={14} className="absolute right-3 top-3 text-[#ffce00] pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Matrix Visualization */}
        <div className="flex-1 relative bg-white p-8 md:p-12 overflow-auto flex items-center justify-center">
          
          {/* Chart Container */}
          <div className="relative w-[800px] h-[600px] border-l-4 border-b-4 border-[#09247c]">
            
            {/* Axis Labels */}
            <div className="absolute -left-12 top-1/2 -rotate-90 font-bold text-[#09247c] tracking-widest text-sm font-display">IMPACTO</div>
            <div className="absolute bottom-[-40px] left-1/2 font-bold text-[#09247c] tracking-widest text-sm font-display">COMPLEXIDADE (Esforço)</div>

            {/* Quadrant Backgrounds */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
              <div className="bg-green-50/30 border-r border-b border-dashed border-[#09247c]/20 flex p-4 text-[#09247c]/10 font-bold text-4xl uppercase select-none font-display">Quick Wins</div>
              <div className="bg-[#ffce00]/10 border-b border-dashed border-[#09247c]/20 flex p-4 justify-end text-[#09247c]/10 font-bold text-4xl uppercase select-none font-display">Grandes Projetos</div>
              <div className="bg-slate-50/50 border-r border-dashed border-[#09247c]/20 flex items-end p-4 text-[#09247c]/10 font-bold text-4xl uppercase select-none font-display">Fill-ins</div>
              <div className="bg-red-50/30 flex items-end justify-end p-4 text-[#09247c]/10 font-bold text-4xl uppercase select-none font-display">Ingratas</div>
            </div>

            {/* Plot Points (Filtered) */}
            {filteredData.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedInitiative(item)}
                className="absolute group transform -translate-x-1/2 -translate-y-1/2 hover:z-50 transition-all hover:scale-125 focus:outline-none"
                style={{
                   left: `${item.avgComplexity}%`,
                   bottom: `${item.avgImpact}%`
                }}
              >
                {/* Cores Semânticas Reforçadas */}
                <div className={`
                  w-8 h-8 rounded-full shadow-lg border-2 border-white 
                  flex items-center justify-center text-[10px] font-bold
                  ${item.priority === 'Alta' ? 'bg-red-500 text-white' : 
                    item.priority === 'Média' ? 'bg-yellow-400 text-slate-900' : 
                    'bg-green-500 text-white'}
                `}>
                  {item.team.substring(0, 2)}
                </div>
                
                {/* Tooltip on Hover */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 bg-[#09247c] text-white text-xs p-3 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-center font-bold shadow-xl">
                  {item.name}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#09247c] rotate-45"></div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Details */}
        {selectedInitiative && (
          <div className="w-96 bg-white border-l border-slate-200 shadow-2xl overflow-y-auto p-8 z-20 absolute right-0 top-0 bottom-0 md:relative">
            <div className="flex justify-between items-start mb-6">
               <h2 className="text-2xl font-bold text-[#09247c] font-display leading-tight">{selectedInitiative.name}</h2>
               <button onClick={() => setSelectedInitiative(null)} className="text-[#8d7041] hover:text-[#09247c]"><X size={24}/></button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-[#f8f9fa] p-4 rounded-xl text-center border border-slate-100">
                    <div className="text-xs text-[#8d7041] uppercase font-bold tracking-wider">Impacto</div>
                    <div className="text-3xl font-bold text-[#09247c] font-display">
                      {(selectedInitiative as any).avgImpact.toFixed(1)}
                    </div>
                 </div>
                 <div className="bg-[#f8f9fa] p-4 rounded-xl text-center border border-slate-100">
                    <div className="text-xs text-[#8d7041] uppercase font-bold tracking-wider">Complexidade</div>
                    <div className="text-3xl font-bold text-[#8d7041] font-display">
                      {(selectedInitiative as any).avgComplexity.toFixed(1)}
                    </div>
                 </div>
              </div>

              <div className="bg-[#f8f9fa] p-5 rounded-xl border border-slate-100">
                <h3 className="text-sm font-bold text-[#09247c] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity size={16}/> Detalhes
                </h3>
                <div className="text-sm space-y-3 text-[#09247c]">
                  <p><span className="font-bold text-[#8d7041]">Time:</span> {selectedInitiative.team}</p>
                  <p><span className="font-bold text-[#8d7041]">Métrica:</span> {selectedInitiative.metric}</p>
                  <p><span className="font-bold text-[#8d7041]">Objetivo:</span> {selectedInitiative.objective}</p>
                  <p><span className="font-bold text-[#8d7041]">KR:</span> {selectedInitiative.keyResult}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#09247c] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users size={16}/> Votos ({selectedInitiative.votes.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                   {selectedInitiative.votes.map((v, idx) => (
                     <div key={idx} className="flex justify-between items-center text-xs bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                        <span className="font-bold text-[#09247c]">{v.userName} <span className="font-normal text-[#8d7041]">({v.userTeam})</span></span>
                        <div className="flex gap-2">
                          <span className="bg-[#09247c] text-white px-2 py-1 rounded font-bold">I:{v.impact}</span>
                          <span className="bg-[#8d7041] text-white px-2 py-1 rounded font-bold">C:{v.complexity}</span>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App Controller ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string>(''); 
  const [view, setView] = useState<'session' | 'login' | 'dashboard' | 'voting' | 'matrix'>('session');
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth Listener
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Erro no login anônimo:", error);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
         setLoading(false);
         const savedSession = localStorage.getItem('prioriza_session_id');
         const savedUser = localStorage.getItem('prioriza_user');
         
         if (savedSession) setSessionId(savedSession);
         if (savedUser && savedSession) {
           setUser(JSON.parse(savedUser));
           setView('dashboard');
         } else if (savedSession) {
           setView('login');
         } else {
           setView('session');
         }
      }
    });
    return unsubscribe;
  }, []);

  // Data Listener 
  useEffect(() => {
    if (!user || !sessionId) return;

    const collRef = collection(db, 'artifacts', sessionId, 'public', 'data', 'initiatives');
    
    const unsubscribe = onSnapshot(collRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Initiative[];
      setInitiatives(data);
    }, (error) => {
      console.error("Erro ao carregar iniciativas:", error);
    });

    return unsubscribe;
  }, [user, sessionId]);

  const handleJoinSession = (id: string) => {
    setSessionId(id);
    localStorage.setItem('prioriza_session_id', id);
    setView('login');
  };

  const handleLogin = (name: string, team: Team) => {
    if (auth.currentUser) {
      const newUser = { uid: auth.currentUser.uid, name, team };
      setUser(newUser);
      localStorage.setItem('prioriza_user', JSON.stringify(newUser));
      setView('dashboard');
    }
  };

  const handleUploadCSV = async (data: any[]) => {
    if (!user || !sessionId) return;
    const collRef = collection(db, 'artifacts', sessionId, 'public', 'data', 'initiatives');
    for (const item of data) {
      await addDoc(collRef, item);
    }
  };

  const handleVote = async (id: string, impact: number, complexity: number) => {
    if (!user || !sessionId) return;

    // Encontra a iniciativa atual para poder atualizar
    const initiative = initiatives.find(i => i.id === id);
    if (!initiative) return;

    const vote: Vote = {
      userId: user.uid,
      userName: user.name,
      userTeam: user.team,
      impact,
      complexity,
      timestamp: Date.now()
    };

    // Lógica de Atualização (Substituição do voto anterior)
    // Filtramos qualquer voto anterior deste usuário e adicionamos o novo
    const updatedVotes = initiative.votes.filter(v => v.userId !== user.uid);
    updatedVotes.push(vote);

    const docRef = doc(db, 'artifacts', sessionId, 'public', 'data', 'initiatives', id);
    await updateDoc(docRef, {
      votes: updatedVotes
    });
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-400">Carregando...</div>;

  if (view === 'session') return <SessionEntry onJoinSession={handleJoinSession} />;

  if (view === 'login') return <Login sessionId={sessionId} onLogin={handleLogin} />;
  
  if (view === 'dashboard' && user) return (
    <Dashboard 
      user={user}
      sessionId={sessionId}
      initiatives={initiatives} 
      onStartVoting={() => setView('voting')} 
      onViewMatrix={() => setView('matrix')}
      onUploadCSV={handleUploadCSV}
      onVote={handleVote} // Passando a função atualizada para o Dashboard
    />
  );

  if (view === 'voting' && user) return (
    <VotingSession 
      user={user} 
      initiatives={initiatives} 
      onVote={handleVote} 
      onExit={() => setView('dashboard')} 
    />
  );

  if (view === 'matrix' && user) return (
    <MatrixResult 
      initiatives={initiatives} 
      onBack={() => setView('dashboard')} 
    />
  );

  return <div>Estado desconhecido</div>;
}
