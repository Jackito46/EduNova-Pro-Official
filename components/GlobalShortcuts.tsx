import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, X, Save, Keyboard, BookOpen, Users, LayoutDashboard, Wallet, Briefcase, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile, UserRole } from '../types';
import { useSchool } from '../contexts/SchoolContext';

interface GlobalShortcutsProps {
  user?: UserProfile | null;
}

export const GlobalShortcuts: React.FC<GlobalShortcutsProps> = ({ user }) => {
  const navigate = useNavigate();
  const { terminology } = useSchool();
  const [showHelp, setShowHelp] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const navigationLinks = [
    { name: 'Tableau de bord', path: '/', icon: LayoutDashboard, shortcut: 'Alt + D' },
    { name: terminology.students || 'Étudiants', path: '/eleves', icon: Users, shortcut: 'Alt + E' },
    { name: terminology.classes || 'Classes', path: '/classes', icon: BookOpen, shortcut: 'Alt + C' },
    { name: 'Économat / Finance', path: '/economat', icon: Wallet, shortcut: 'Alt + F' },
    { name: 'Présences', path: '/presences', icon: Users, shortcut: 'Alt + A' },
  ];

  const hasAccessToLink = (path: string) => {
    if (!user) return false;
    if (user.is_super_admin || user.role === UserRole.SUPER_ADMIN) return true;
    
    const adminRoles = [UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR];
    const financeRoles = [...adminRoles, UserRole.ACCOUNTANT];
    const hrRoles = [...adminRoles];
    const academicRoles = [...adminRoles, UserRole.SECRETARY, UserRole.TEACHER, UserRole.SUPERVISOR];
    const restrictedAcademicRoles = [...adminRoles, UserRole.SECRETARY, UserRole.SUPERVISOR];
    
    switch (path) {
      case '/':
        return true;
      case '/eleves':
        return restrictedAcademicRoles.includes(user.role);
      case '/classes':
        return restrictedAcademicRoles.includes(user.role);
      case '/economat':
        return financeRoles.includes(user.role);
      case '/personnel':
        return hrRoles.includes(user.role);
      case '/rapports':
        return [...financeRoles, UserRole.SECRETARY].includes(user.role);
      case '/notes':
        return academicRoles.includes(user.role);
      case '/presences':
        return academicRoles.includes(user.role);
      case '/horaire':
        return academicRoles.includes(user.role);
      case '/settings/ecole':
        return adminRoles.includes(user.role);
      default:
        return false;
    }
  };

  const filteredLinks = navigationLinks.filter(link => 
    hasAccessToLink(link.path) && link.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!user || user.role === UserRole.STUDENT || user.role === UserRole.PARENT) {
      return;
    }

    const handleOpenHelp = () => {
      // Ignorer complètement sur mobile et tablette
      if (window.innerWidth < 1024) return;
      setShowHelp(true);
      setShowSearch(false);
    };

    const handleOpenSearch = () => {
      if (window.innerWidth < 1024) return;
      setShowSearch(true);
      setShowHelp(false);
    };

    document.addEventListener('openShortcutHelp', handleOpenHelp);
    document.addEventListener('openShortcutSearch', handleOpenSearch);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer les raccourcis clavier sur smartphone/tablette (< 1024px)
      if (window.innerWidth < 1024) return;

      const isExternalUser = user?.role === UserRole.STUDENT || user?.role === UserRole.PARENT;

      // Escape : Close Modals is allowed for all users as a general convenience
      if (e.key === 'Escape') {
        setShowHelp(false);
        setShowSearch(false);
        
        // Click any standard close buttons/backdrops in current active overlays
        const closeBtn = document.querySelector('button[aria-label="Fermer"]') || 
                          document.querySelector('button[title="Fermer"]') || 
                          document.querySelector('button[title="Annuler"]') || 
                          document.querySelector('.modal-close') ||
                          document.querySelector('button:has(svg.lucide-x)');
        if (closeBtn) {
          (closeBtn as HTMLButtonElement).click();
          toast.info("Fenêtre fermée", { duration: 1000 });
        }
        
        // Also dispatch custom event for component modals
        document.dispatchEvent(new CustomEvent('globalCloseModals'));
        return;
      }

      // Restrict all other global key combinations for external portal accounts (students and parents)
      if (isExternalUser) {
        return;
      }

      // Don't trigger shortcuts if user is typing in an input/textarea (except for Ctrl+S / Ctrl+K / Ctrl+/)
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      
      // Ctrl + K : Search / Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
        setShowHelp(false);
      }
      
      // Ctrl + / : Help Modal
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowHelp(prev => !prev);
        setShowSearch(false);
      }
      
      // Ctrl + S : Save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const form = document.querySelector('form');
        if (form && typeof form.requestSubmit === 'function') {
          form.requestSubmit();
          toast.info("Sauvegarde déclenchée", {
             description: "Le formulaire actif a été soumis via Ctrl+S.",
             duration: 2000
          });
        } else {
          document.dispatchEvent(new CustomEvent('globalSave'));
          toast.info("Sauvegarde déclenchée", {
             description: "Raccourci de sauvegarde (Ctrl+S) activé.",
             duration: 2000
          });
        }
      }

      // Ctrl + N or Alt + N : Create New Record
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') || (e.altKey && e.key.toLowerCase() === 'n' && !isInputFocused)) {
        e.preventDefault();
        
        // Dispatch custom event first for component-specific actions
        const customDispatched = document.dispatchEvent(new CustomEvent('globalCreateNew', { cancelable: true }));
        
        // Router-based fallbacks based on path
        const pathname = window.location.pathname;
        if (pathname.startsWith('/eleves')) {
          const studentMgmtRoles = [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.SECRETARY];
          if (studentMgmtRoles.includes(user.role)) {
            navigate('/eleves/ajouter');
            toast.info("Nouveau dossier Élève", { description: "Ouverture du formulaire d'inscription." });
          }
        } else if (pathname.startsWith('/classes')) {
          const adminRoles = [UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR];
          if (adminRoles.includes(user.role)) {
            navigate('/classes/ajouter');
            toast.info("Nouvelle Classe", { description: "Ouverture du formulaire de création." });
          }
        } else if (pathname.startsWith('/personnel')) {
          const adminRoles = [UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR];
          if (adminRoles.includes(user.role)) {
            navigate('/personnel/embaucher');
            toast.info("Nouveau Personnel", { description: "Ouverture du formulaire d'embauche." });
          }
        } else if (pathname.startsWith('/economat/depenses')) {
          const financeAdminRoles = [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT];
          if (financeAdminRoles.includes(user.role)) {
            navigate('/economat/depenses/ajouter');
            toast.info("Nouvelle Dépense", { description: "Ouverture du formulaire d'enregistrement." });
          }
        } else if (pathname.startsWith('/economat')) {
          const cashierRoles = [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.SECRETARY];
          if (cashierRoles.includes(user.role)) {
            navigate('/economat/frais');
            toast.info("Nouveau Paiement", { description: "Formulaire de scolarité actif." });
          }
        }
      }

      // Alt Navigation Shortcuts (only if not typing in input)
      if (e.altKey && !isInputFocused) {
        const key = e.key.toLowerCase();
        let targetPath = '';
        if (key === 'd' || key === 'h') targetPath = '/';
        else if (key === 'e') targetPath = '/eleves';
        else if (key === 'c') targetPath = '/classes';
        else if (key === 'f') targetPath = '/economat';
        else if (key === 'a') targetPath = '/presences';

        if (targetPath && hasAccessToLink(targetPath)) {
          e.preventDefault();
          navigate(targetPath);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('openShortcutHelp', handleOpenHelp);
      document.removeEventListener('openShortcutSearch', handleOpenSearch);
    };
  }, [navigate, user]);

  return (
    <>
      {/* Search Modal (Command Palette) */}
      {showSearch && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center pt-[20vh] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="flex items-center px-4 py-3 border-b border-slate-100">
              <Search className="text-slate-400 w-5 h-5 mr-3" />
              <input
                autoFocus
                type="text"
                placeholder="Rechercher une section... (ex: Élèves, Finances)"
                className="flex-1 bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredLinks.length > 0) {
                    navigate(filteredLinks[0].path);
                    setShowSearch(false);
                    setSearchQuery('');
                  }
                }}
              />
              <button onClick={() => setShowSearch(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1 rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {filteredLinks.length > 0 ? (
                filteredLinks.map((link, idx) => (
                  <button
                    key={link.path}
                    onClick={() => {
                      navigate(link.path);
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${idx === 0 && searchQuery ? 'bg-slate-100 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 text-slate-500">
                        <link.icon className="w-4 h-4" />
                      </div>
                      <span className="font-medium">{link.name}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded border border-slate-200">{link.shortcut}</span>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500">
                  Aucun résultat trouvé pour "{searchQuery}"
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
              <span>Utilisez les flèches ou tapez pour filtrer</span>
              <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded border border-slate-300">Entrée pour valider</span>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="hidden lg:flex fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 my-8">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Keyboard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Raccourcis Clavier Globaux</h2>
                  <p className="text-sm text-slate-500">Naviguez et travaillez à la vitesse de l'éclair dans EduNova Pro</p>
                </div>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-slate-600 bg-white shadow-sm border border-slate-200 p-2 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto">
              
              {/* Globaux */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 border-b border-indigo-50 pb-2">Actions Globales</h3>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Search className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Recherche rapide / Menu</span>
                  </div>
                  <div className="flex space-x-1">
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 shadow-sm">Ctrl</kbd>
                    <span className="text-slate-400">+</span>
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 shadow-sm">K</kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Save className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Sauvegarder le formulaire</span>
                  </div>
                  <div className="flex space-x-1">
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 shadow-sm">Ctrl</kbd>
                    <span className="text-slate-400">+</span>
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 shadow-sm">S</kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Keyboard className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-medium text-slate-700 font-bold">Créer nouvel enregistrement</span>
                  </div>
                  <div className="flex space-x-1">
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 shadow-sm">Ctrl</kbd>
                    <span className="text-slate-400">+</span>
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 shadow-sm">N</kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between pl-7">
                  <span className="text-xs text-slate-400">Alternative sans conflit</span>
                  <div className="flex space-x-1">
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-500 shadow-sm">Alt</kbd>
                    <span className="text-slate-400">+</span>
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-500 shadow-sm">N</kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Keyboard className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Afficher cette aide</span>
                  </div>
                  <div className="flex space-x-1">
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 shadow-sm">Ctrl</kbd>
                    <span className="text-slate-400">+</span>
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 shadow-sm">/</kbd>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <X className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 font-bold">Fermer n'importe quelle modale</span>
                  </div>
                  <div className="flex space-x-1">
                    <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 shadow-sm">Echap</kbd>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 border-b border-indigo-50 pb-2">Navigation Rapide</h3>
                
                {navigationLinks.filter(link => hasAccessToLink(link.path)).map((link) => (
                  <div key={link.path} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <link.icon className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">
                        {link.name === 'Tableau de bord' ? 'Tableau de bord' : `Aller à/aux ${link.name}`}
                      </span>
                    </div>
                    <div className="flex space-x-1">
                      {link.shortcut.split(' + ').map((key, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="text-slate-400">+</span>}
                          <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-600 shadow-sm">{key}</kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
              <span>Astuce : Le raccourci <strong>Ctrl + N</strong> s'adapte automatiquement à votre page courante.</span>
              <button onClick={() => setShowHelp(false)} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                Compris !
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
