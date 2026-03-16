
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { DiagnosticResult, QuizQuestion, TheoryData } from "../types";
import { SERVICES_CATALOG } from "../constants";

declare var process: any;

const BASE_NFF_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2DNRAkfdY6ewmfvguMEfDEk_WAXXt5jy6pWHvGAodKlp1TjgHdK_rfaawntFAGyVboD6XDPhbuRKj/pub?output=csv";
// URL du script Google Apps Script (à configurer par l'utilisateur)
const BACKLOG_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxhpWv-oQVlqLr2Tmz2QRBcE3gBETS9txleiIFc_pgjf7YPYTCiytumgxxOQFCkWKNB/exec";

export class GeminiService {
  private rawNffRows: string[][] = [
    ["Lave-linge", "Ne vidange pas", "Filtre obstrué par pièce de monnaie - Nettoyage fait"],
    ["Cafetière Broyeur", "Fuite d'eau sous la machine", "Bac mal enclenché - Remis en place"],
    ["Smartphone", "Écran noir", "Batterie déchargée profonde - Charge longue effectuée"],
    ["Aspirateur Balai", "N'aspire plus", "Tube bouché par un jouet - Retiré"],
    ["Sèche-linge", "Ne sèche pas", "Condenseur encrassé - Nettoyage effectué"]
  ];
  private isDbLoading: boolean = false;

  private getAIInstance() {
    const key = process.env.API_KEY;
    if (!key) throw new Error("AUTH_ERROR|Clé API non configurée.");
    return new GoogleGenAI({ apiKey: key });
  }

  private async callWithRetry(fn: () => Promise<any>, retries = 5, delay = 1500): Promise<any> {
    try {
      return await fn();
    } catch (error: any) {
      const errorStr = JSON.stringify(error);
      const isOverloaded = errorStr.includes("503") || 
                          errorStr.includes("overloaded") || 
                          error.message?.includes("503") || 
                          error.message?.includes("UNAVAILABLE");

      if (isOverloaded && retries > 0) {
        console.log(`Model overloaded, retrying in ${delay}ms... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.callWithRetry(fn, retries - 1, delay * 1.5);
      }
      
      // Si c'est une erreur 503 finale, on renvoie un message propre
      if (isOverloaded) {
        throw new Error("Le service est momentanément surchargé. Veuillez patienter quelques secondes et réessayer.");
      }
      
      throw error;
    }
  }

  async fetchNFFKnowledgeBase(force: boolean = false) {
    if ((this.rawNffRows.length > 0 && !force) || this.isDbLoading) return;
    this.isDbLoading = true;
    
    const fetchWithTimeout = async (url: string, timeout = 5000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (e) {
        clearTimeout(id);
        throw e;
      }
    };

    try {
      // Simplification du fetch pour éviter les problèmes de preflight/CORS restrictifs
      const response = await fetchWithTimeout(BASE_NFF_URL);
      if (!response.ok) throw new Error(`HTTP_ERR|${response.status}`);
      const csv = await response.text();
      const lines = csv.split('\n').slice(1);
      this.rawNffRows = lines
        .map(line => line.split(',').map(cell => cell.replace(/^"|"$/g, '').trim()))
        .filter(row => row.length >= 2);
      console.log(`NFF Database synced: ${this.rawNffRows.length} rows.`);
    } catch (e: any) {
      console.warn("Sync NFF Error (Using fallback DB):", e.message);
      // On ne vide pas la base, on garde les données de secours
    } finally {
      this.isDbLoading = false;
    }
  }

  async logActivity(store: string, type: 'FILTRAGE' | 'ACADEMIE' | 'CHATBOT', details?: string, extra?: string) {
    try {
      // On ne bloque pas l'utilisateur si le log échoue
      fetch(BACKLOG_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Important pour Google Apps Script
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toLocaleString('fr-FR'),
          magasin: store,
          type: type,
          details: details || "",
          extra: extra || ""
        })
      }).catch(e => console.warn("Backlog log error:", e));
    } catch (e) {
      console.warn("Backlog log error:", e);
    }
  }

  private getFilteredContext(categoryName: string, limit: number = 10) {
    if (this.rawNffRows.length === 0) return "";
    const keywords = (categoryName || "").toLowerCase().split(' ');
    const filtered = this.rawNffRows.filter(row => {
      const typology = (row[0] || "").toLowerCase();
      const model = (row[1] || "").toLowerCase();
      return keywords.some(kw => kw.length > 3 && (typology.includes(kw) || model.includes(kw)));
    });
    const shuffled = filtered.sort(() => 0.5 - Math.random()).slice(0, limit);
    return shuffled.length > 0 
      ? "HISTORIQUE RÉEL NFF (Base de données) :\n" + 
        shuffled.map(row => `- Typo: ${row[0]} | Modèle: ${row[1]} | Panne: ${row[2]} | Solution NFF: ${row[3]}`).join('\n') 
      : "";
  }

  async performDiagnosis(productType: string, brand: string, model: string, symptom: string): Promise<DiagnosticResult> {
    const nffContext = this.getFilteredContext(productType);
    const ai = this.getAIInstance();

    return this.callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `DOSSIER TECHNIQUE SAV :\nPRODUIT : ${productType} ${brand} ${model}\nSYMPTÔME DÉCLARÉ : ${symptom}\n\n${nffContext}\n\nCATALOGUE SERVICES SAV :\n${SERVICES_CATALOG}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `Tu es l'Ingénieur Référent National SAV Boulanger. 
Ton rôle est de traquer la cause racine profonde pour éviter les retours ateliers inutiles.

QUALITÉ TECHNIQUE EXIGÉE POUR LE RÉSUMÉ PHEBUS :
- symptom_fragment : Description technique courte et factuelle.
- observation_fragment : Observation STRICTEMENT FACTUELLE après tests. INTERDICTION d'utiliser "soupçon", "probable", "peut-être". Décris ce qui se passe réellement (ex: "Aucun débit malgré pompe active").
- AUCUNE mention de cause racine ni d'en-tête de type "Résumé Expert" dans les fragments.

DIRECTIVES GÉNÉRALES :
- DIAGNOSTIC : Identifie le composant précis.
- FOCUS TECHNIQUE : Explique de manière pédagogique la cause du problème ET décris précisément la TOUTE PREMIÈRE ACTION de filtrage à réaliser au comptoir.
- CONTRÔLE DE RECEVABILITÉ : Donne une instruction claire sur le risque de NFF (No Fault Found) ou la validité de la prise en charge sous garantie selon les symptômes.
- USAGE : Explique comment vérifier un mauvais usage.
- EXCLUSION : Interdiction ABSOLUE de citer "Infinity" ou "Club Infinity" ou le "Prêt" dans les services ou n'importe où ailleurs.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cause: { type: Type.STRING },
              professional_summary: { type: Type.STRING },
              technical_focus: { type: Type.STRING, description: "Explication du problème + première action de filtrage" },
              receivability_control: { type: Type.STRING, description: "Risque NFF ou validité garantie" },
              sav_info: { type: Type.STRING },
              isHardwareFailure: { type: Type.BOOLEAN },
              symptom_fragment: { type: Type.STRING },
              observation_fragment: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { title: { type: Type.STRING }, instruction: { type: Type.STRING }, icon: { type: Type.STRING }, summary_fragment: { type: Type.STRING } },
                  required: ["title", "instruction", "icon", "summary_fragment"]
                }
              },
              accessories: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { name: { type: Type.STRING }, price: { type: Type.STRING }, reason: { type: Type.STRING } },
                  required: ["name", "price", "reason"]
                }
              },
              services: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT, 
                  properties: { name: { type: Type.STRING }, price: { type: Type.STRING }, reason: { type: Type.STRING } }, 
                  required: ["name", "price", "reason"] 
                } 
              },
              sn_location_guide: { type: Type.STRING },
              packaging_precautions: { type: Type.STRING },
              accessories_to_include: { type: Type.STRING },
              loan_eligibility_reminder: { type: Type.STRING }
            },
            required: ["cause", "professional_summary", "technical_focus", "receivability_control", "steps", "sav_info", "isHardwareFailure", "accessories", "services", "symptom_fragment", "observation_fragment", "sn_location_guide", "packaging_precautions", "accessories_to_include", "loan_eligibility_reminder"]
          }
        }
      });
      return this.safeParseJSON(response.text);
    });
  }

  async generateTheory(category: string): Promise<TheoryData> {
    const ai = this.getAIInstance();
    const nffExamples = this.getFilteredContext(category, 5);
    return this.callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Module expert : ${category}.\n\n${nffExamples}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: "Formateur Expert SAV. Apprends aux équipes à différencier Panne Réelle, Mauvais Usage et Défaut d'entretien.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              intro: { type: Type.STRING },
              top_issues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { issue: { type: Type.STRING }, identification: { type: Type.STRING }, quick_fix: { type: Type.STRING } },
                  required: ["issue", "identification", "quick_fix"]
                }
              },
              pro_tip: { type: Type.STRING }
            },
            required: ["category", "intro", "top_issues", "pro_tip"]
          }
        }
      });
      return this.safeParseJSON(response.text);
    });
  }

  async generateQuizQuestion(category: string, difficulty: string, history: { themes: string[], correctIndices: number[] }): Promise<QuizQuestion> {
    const ai = this.getAIInstance();
    
    // Logique 80/10/10 stricte basée sur l'historique récent (taille 10)
    const recentThemes = history.themes.slice(-10);
    const filteringCount = recentThemes.filter(t => t === 'FILTERING').length;
    const regCount = recentThemes.filter(t => t === 'REGULATION').length;
    
    let themeType = 'FILTERING';
    if (filteringCount >= 8 && regCount < 1) themeType = 'REGULATION';
    else if (filteringCount >= 8 && regCount >= 1) themeType = 'CONTROL';
    else {
        const r = Math.random();
        if (r < 0.8) themeType = 'FILTERING';
        else if (r < 0.9) themeType = 'REGULATION';
        else themeType = 'CONTROL';
    }

    // Déterminer si on force un choix multiple (30% de probabilité)
    const isMultipleChoice = Math.random() < 0.35;

    let themePrompt = "";
    if (themeType === 'FILTERING') {
        const sub = Math.random();
        if (sub < 0.4) themePrompt = "USAGE CLIENT : Comportement normal mal compris (ex: cycles éco longs, bruits de dilatation, condensation).";
        else if (sub < 0.7) themePrompt = "DIAGNOSTIC TECHNIQUE : Cas expert (code erreur spécifique, mesure multimètre, test de continuité).";
        else themePrompt = "NFF RÉEL : Cas inspiré de la base de données (filtrage raté au comptoir).";
    } else if (themeType === 'REGULATION') {
        themePrompt = "RÉGLEMENTATION : Garantie légale, exclusions (oxydation, choc, usage pro), délais.";
    } else {
        themePrompt = "POINTS DE CONTRÔLE : Numéro de série (SN), emballage Lithium, indices visuels de choc.";
    }

    const lastCorrectIndex = history.correctIndices.length > 0 ? history.correctIndices[history.correctIndices.length - 1] : -1;

    const instruction = `Tu es l'Ingénieur du Labo SAV Boulanger. 
    AUCUNE MENTION DU PRÊT. 
    
    HISTORIQUE DES THÈMES PRÉCÉDENTS : ${recentThemes.join(', ')}. 
    NE RÉPÈTE PAS les mêmes pannes. Varie les univers (Lavage, Froid, TV, Smartphone, Mobilité).
    
    CONTRAINTE DE FORMAT : 
    - Si type="multiple", propose une question où PLUSIEURS réponses sont nécessaires (ex: "Quels sont les 3 contrôles à faire ?").
    - L'indice de la bonne réponse principale NE DOIT PAS être ${lastCorrectIndex}. 
    
    OBJECTIF : Apprendre à différencier une panne réelle d'un usage incorrect.
    - Pour AVANCÉ/LÉGENDAIRE : Inclus des codes erreurs réels et des mesures techniques.
    - Explique TOUJOURS dans l'explication l'approche métier (Comment le vérifier ? Comment l'expliquer au client ?)`;

    return this.callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Génère une question ${difficulty} pour ${category}. Thème cible : ${themePrompt}. Type forcé : ${isMultipleChoice ? 'multiple (plusieurs réponses correctes)' : 'single (une seule réponse)'}. Seed: ${Math.random()}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: instruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scenario: { type: Type.STRING },
              product_context: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["single", "multiple"] },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correct_indices: { type: Type.ARRAY, items: { type: Type.INTEGER } },
              explanation: { type: Type.STRING },
              internal_theme_tag: { type: Type.STRING, description: "Doit être 'FILTERING', 'REGULATION' ou 'CONTROL'" }
            },
            required: ["scenario", "product_context", "difficulty", "type", "question", "options", "correct_indices", "explanation", "internal_theme_tag"]
          }
        }
      });
      return this.safeParseJSON(response.text);
    });
  }

  async generateVisualGuide(product: string, category: string, focusDescription: string): Promise<string | undefined> {
    const ai = this.getAIInstance();
    const prompt = `Ultra-minimalist schematic illustration of ${product}. Focus ONLY on this action: ${focusDescription}. Use bold black lines on a white background. NO complex labels, NO checklists, NO small text. Use only 1 or 2 large, clear red arrows to show the action. Style: clean, flat, 2D vector icon style. Extreme simplicity is mandatory. The image must be instantly understandable.`;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: { 
          imageConfig: { 
            aspectRatio: "1:1",
            imageSize: "1K"
          } 
        }
      });
      
      // Find the image part in the response candidates
      for (const candidate of response.candidates || []) {
        if (!candidate.content?.parts) continue;
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
      return undefined;
    } catch (error) { 
      console.error("Image generation error:", error);
      return undefined; 
    }
  }

  async chat(productInfo: string, symptom: string, diagnosticContext: string, history: { role: 'user' | 'model', text: string }[]): Promise<string> {
    const ai = this.getAIInstance();
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      history: history.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      })),
      config: {
        systemInstruction: `Tu es l'Ingénieur Référent National SAV Boulanger. 
        Tu aides un conseiller au comptoir à approfondir un filtrage technique.
        CONTEXTE DU PRODUIT : ${productInfo}
        SYMPTÔME INITIAL : ${symptom}
        DIAGNOSTIC PRÉCÉDENT : ${diagnosticContext}
        
        Réponds de manière courte, technique et pédagogique. 
        Ton but est d'aider à confirmer si le produit doit partir en SAV ou si une manipulation supplémentaire peut résoudre le problème sur place.
        INTERDICTION de citer "Infinity", "Club Infinity" ou le "Prêt".`,
      },
    });

    return this.callWithRetry(async () => {
      const lastMessage = history[history.length - 1].text;
      const response = await chat.sendMessage({ message: lastMessage });
      return response.text || "Désolé, je n'ai pas pu générer de réponse.";
    });
  }

  private safeParseJSON(text: string | undefined): any {
    if (!text) return null;
    try {
      const cleaned = text.replace(/```json\n?|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON Parsing Error:", e, "Raw text:", text);
      return null;
    }
  }
}
