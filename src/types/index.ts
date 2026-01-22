export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
}

export interface DocumentUpload {
  id: string;
  userId: string;
  filename: string;
  originalUrl: string;
  processedUrls: string[]; // Multiple processed images for multi-document detection
  timestamp: Date;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
  metadata?: {
    fileSize: number;
    fileType: string;
    dimensions?: {
      width: number;
      height: number;
    };
  };
}

export interface Point {
  x: number;
  y: number;
}

export interface DocumentContour {
  points: Point[];
  confidence: number;
}

export interface ProcessingResult {
  success: boolean;
  processedImages: string[]; // Base64 or blob URLs
  contours: DocumentContour[];
  error?: string;
}

// Backend API response types
export interface DetectionApiResponse {
  success: boolean;
  corners: [number, number][];
  confidence: number;
  method: string;
  preview: string;
  warning: string | null;
}

export interface FinalizeApiResponse {
  success: boolean;
  originalUrl: string;
  processedUrls: string[];
  message?: string;
  warning?: string;
}

export interface CropCorner {
  x: number;
  y: number;
}
