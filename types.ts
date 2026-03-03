
export type DiagnosticStep = {
  title: string;
  instruction: string;
  icon: string;
  summary_fragment: string;
};

export type DiagnosticResult = {
  symptom: string;
  cause: string;
  steps: DiagnosticStep[];
  maintenance: string;
  sav_info: string;
  professional_summary: string;
  isHardwareFailure: boolean;
  is_infinity_eligible: boolean;
  technical_focus: string;
  visual_guide?: string;
  accessories: { name: string; price: string; reason: string }[];
  services: { name: string; price: string; reason: string; type?: string }[];
  
  symptom_fragment: string;
  observation_fragment: string;
  
  phebus_summary: string;
  sn_location_guide: string;
  packaging_precautions: string;
  accessories_to_include: string;
  loan_eligibility_reminder: string;
};

export type QuizQuestion = {
  scenario: string;
  product_context: string;
  difficulty: string;
  type: 'single' | 'multiple';
  question: string;
  options: string[];
  correct_indices: number[];
  explanation: string;
};

export type TheoryData = {
  category: string;
  intro: string;
  top_issues: { 
    issue: string; 
    identification: string; 
    quick_fix: string;
    image?: string;
    type?: string;
    frequency?: string;
  }[];
  pro_tip: string;
};

export enum View {
  Diagnosis = 'diagnosis',
  TrainingHome = 'training_home',
  TrainingTheory = 'training_theory',
  TrainingQuiz = 'training_quiz'
}

export type Category = {
  id: string;
  name: string;
  icon: string;
};
