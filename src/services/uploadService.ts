import { auth } from '../config/firebase';

const API_BASE = process.env.REACT_APP_PROD_URL|| "http://127.0.0.1:8000";

export interface DetectionResponse {
  success: boolean;
  fileId: string;
  userId: string;
  originalUrl: string;
  previewUrl: string;
  croppedUrl: string;
  status: string;
  isProcessed: boolean;
  corners: [number, number][];
  confidence: number;
  method: string;
  warning: string | null;
  imageSize: {
    width: number;
    height: number;
  };
  error?: string;
}

export interface Corner {
  x: number;
  y: number;
}

export interface CropApiResponse {
  success: boolean;
  fileId?: string;
  croppedUrl?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  enhanced?: boolean;
  error?: string;
}

export interface FinalizeResponse {
  success: boolean;
  croppedUrl: string;
  dimensions?: {
    width: number;
    height: number;
  };
  error?: string;
}


export async function detectDocumentCorners(file: File): Promise<DetectionResponse> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }

    const token = await user.getIdToken();

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/api/v1/uploads/uploads/detect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Detection failed");
    }

    return response.json();
  } catch (err: any) {
    console.error('Detection error:', err);
    throw new Error(err.message || "Detection failed");
  }
}

export async function finalizeDocumentCrop(
  fileId: string, 
  corners: Corner[],
  enhance: boolean = true,
  autoTrim: boolean = true
): Promise<FinalizeResponse> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }

    const token = await user.getIdToken();

    const formData = new FormData();
    formData.append("file_id", fileId);
    
    // Convert corners to the format backend expects: [[x,y], [x,y], [x,y], [x,y]]
    const cornersArray = corners.map(c => [Math.round(c.x), Math.round(c.y)]);
    formData.append("user_crop_data", JSON.stringify(cornersArray));
    formData.append("enhance", String(enhance));
    formData.append("auto_trim", String(autoTrim));

    const response = await fetch(`${API_BASE}/api/v1/uploads/uploads/crop`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || err.error || "Processing failed");
    }

    const apiResponse: CropApiResponse = await response.json();
    
    if (!apiResponse.success) {
      throw new Error(apiResponse.error || "Processing failed");
    }

    return {
      success: true,
      croppedUrl: apiResponse.croppedUrl || '',
      dimensions: apiResponse.dimensions
    };
  } catch (err: any) {
    console.error('Finalize error:', err);
    throw new Error(err.message || "Processing failed");
  }
}

export async function uploadFileToBackend(file: File) {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }

    const token = await user.getIdToken();

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/api/v1/uploads/uploads/detect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Upload failed");
    }

    return response.json();
  } catch (err: any) {
    console.error('Upload error:', err);
    throw new Error(err.message || "Upload failed");
  }
}

// Response type for list API
export interface UploadListItem {
  fileId: string;
  filename: string;
  originalUrl: string;
  previewUrl: string;
  croppedUrl: string;
  status: string;
  isProcessed: boolean;
  createdAt: string;
}

export interface ListUploadsResponse {
  success: boolean;
  userId: string;
  count: number;
  uploads: UploadListItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

export async function listUserUploads(
  limit: number = 20,
  cursor: string | null = null
): Promise<ListUploadsResponse> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }

    const token = await user.getIdToken();

    const formData = new FormData();
    formData.append("limit", String(limit));
    if (cursor) {
      formData.append("cursor", cursor);
    }

    const response = await fetch(`${API_BASE}/api/v1/uploads/uploads/list`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Failed to fetch uploads");
    }

    return response.json();
  } catch (err: any) {
    console.error('List uploads error:', err);
    throw new Error(err.message || "Failed to fetch uploads");
  }
}

export const API_BASE_URL = API_BASE;
