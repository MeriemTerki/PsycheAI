export interface EmotionReport {
  summary: string;
  stats: string;
  interpretation: string;
}

export interface EyeTrackingReport {
  report: string;
}

export interface DiagnosisAndTreatment {
  diagnosis: string;
  treatment: string;
}

export interface DiagnosisResponse {
  transcript: string;
  emotion_report: EmotionReport;
  eye_tracking_report: EyeTrackingReport;
  diagnosis_and_treatment: DiagnosisAndTreatment;
}