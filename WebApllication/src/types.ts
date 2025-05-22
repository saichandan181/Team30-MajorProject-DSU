export interface AnalysisResult {
  id: string;
  timestamp: number;
  imageUrl: string;
  level: number;
  description: string;
}

export interface ImageFilters {
  brightness: number;
  contrast: number;
  saturation: number;
}