
import React from 'react';
import { 
  Droplet, Battery, Zap, Wifi, Trash2, Disc, Wind, 
  Thermometer, Power, Wrench, Layers, Settings, 
  AlertTriangle, Monitor, Sparkles, Anchor, BookOpen, 
  CheckCircle, Star, Medal, Smartphone, Bike
} from 'lucide-react';
import { QuizQuestion, TheoryData, Category } from './types';

export const COLORS = {
  orange: '#f56a00',
  bleuFonce: '#1b1d29',
  bleuClair: '#cac9f6',
  bleuGris: '#eaeaf7',
  blanc: '#ffffff'
};

export const SERVICES_CATALOG = `
MATRICE DES SERVICES BOULANGER (ENTRETIEN & MISE EN SERVICE) :
- Entretien & Détartrage (Cafetière filtre / boissons portionnées) : 14,99€ (Code 1223333)
- Entretien & Détartrage (Broyeur / Centrale vapeur) : 39,99€ (Code 1226177)
- Nettoyage (Aspirateur balai, laveur, robot) : 39,99€ (Code 1226265)
- Nettoyage (Smartphone) : 14,99€ (Code 1226269)
- Nettoyage (PC / Imprimante) : 29,99€ (Code 1226281)
- Transfert de données (Smartphone / Tablette) : 19,90€ (Code 1088599)
- Mise en service (Smartphone / Tablette / Montre) : 19,99€ (Code 1226286)
- Transfert + Mise en service (Smartphone / Tablette) : 29,99€ (Code 1226288)
- Transfert de données PC (<100Go) : 29,99€ (Code 1226290)
- Transfert de données PC (+100Go) : 49,99€ (Code 1229581)
- Mise en service (PC / Imprimante) : 29,99€ (Code 1226332)
- Réinitialisation PC (Sortie d'usine) : 49,99€ (Code 1226333)
- Montage Ventilateur : 9,99€ (Code 1226284)
- Montage Trottinette : 29,00€ (Code 1226283)
`;

export const TECH_ICONS: Record<string, React.ElementType> = {
  water: Droplet, battery: Battery, electric: Zap, wifi: Wifi, trash: Trash2,
  filter: Disc, air: Wind, temp: Thermometer, power: Power, fix: Wrench,
  part: Layers, setup: Settings, alert: AlertTriangle, screen: Monitor,
  clean: Sparkles, base: Anchor
};

export const CATEGORIES: Category[] = [
  { id: 'smartphones', name: 'Smartphones', icon: '📱' },
  { id: 'mobility', name: 'Mobilité (Trot/Draisienne)', icon: '🛴' },
  { id: 'lavage', name: 'Soin du linge', icon: '🧺' },
  { id: 'vaisselle', name: 'Lavage vaisselle', icon: '🍽️' },
  { id: 'froid', name: 'Froid & Conservation', icon: '❄️' },
  { id: 'cuisson', name: 'Cuisson encastrable', icon: '🔥' },
  { id: 'petit_dej', name: 'Préparation Petit Déjeuner', icon: '☕' },
  { id: 'cuisine', name: 'Préparation culinaire', icon: '🍲' },
  { id: 'entretien_sol', name: 'Entretien des sols', icon: '🧹' },
  { id: 'beaute', name: 'Beauté & Santé', icon: '💇' },
  { id: 'tv', name: 'TV & Home Cinéma', icon: '📺' },
  { id: 'info', name: 'Informatique & Tablettes', icon: '💻' },
];

export const RANKS = [
  { min: 0, title: "Stagiaire Accueil", color: "text-[#1b1d29]", icon: BookOpen },
  { min: 200, title: "Conseiller Junior", color: "text-[#f56a00]", icon: CheckCircle },
  { min: 500, title: "Expert Services", color: "text-[#1b1d29]", icon: Sparkles },
  { min: 1000, title: "Référent Technique", color: "text-[#f56a00]", icon: Star },
  { min: 2000, title: "Maître du Comptoir", color: "text-[#f56a00]", icon: Medal },
];

export const FALLBACK_DB: Record<string, QuizQuestion[]> = {
  'default': [
    {
      scenario: "Un dossier Phebus revient de station de réparation avec la mention 'NFF'.",
      product_context: "Vocabulaire SAV",
      difficulty: "DÉBUTANT",
      type: "single",
      question: "Que signifie cet acronyme ?",
      options: [
        "Nettoyage Filtre Fait", 
        "No Failure Found (Aucune panne constatée)", 
        "Nouveau Flux de Facturation", 
        "Note de Frais Forfaitaire"
      ],
      correct_indices: [1],
      explanation: "NFF signifie qu'aucun défaut n'a été trouvé par le réparateur. Cela indique souvent un défaut de filtrage au comptoir."
    }
  ]
};
