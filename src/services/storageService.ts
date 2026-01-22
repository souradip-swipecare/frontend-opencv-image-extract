import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, getDocs, query, where, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../config/firebase';
import { DocumentUpload } from '../types';

export class StorageService {
  private readonly COLLECTION_NAME = 'documents';

  async uploadImages(
    userId: string,
    filename: string,
    originalImage: string,
    processedImages: string[]
  ): Promise<{ originalUrl: string; processedUrls: string[] }> {
    try {
      const originalRef = ref(storage, `users/${userId}/original/${Date.now()}_${filename}`);
      await uploadString(originalRef, originalImage, 'data_url');
      const originalUrl = await getDownloadURL(originalRef);

      const processedUrls: string[] = [];
      for (let i = 0; i < processedImages.length; i++) {
        const processedRef = ref(
          storage,
          `users/${userId}/processed/${Date.now()}_${i}_${filename}`
        );
        await uploadString(processedRef, processedImages[i], 'data_url');
        const processedUrl = await getDownloadURL(processedRef);
        processedUrls.push(processedUrl);
      }

      return { originalUrl, processedUrls };
    } catch (error) {
      console.error('Upload error:', error);
      throw new Error('Failed to upload images');
    }
  }


  async saveDocumentMetadata(
    userId: string,
    filename: string,
    originalUrl: string,
    processedUrls: string[],
    metadata?: any
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
        userId,
        filename,
        originalUrl,
        processedUrls,
        timestamp: Timestamp.now(),
        status: 'completed',
        metadata: metadata || {}
      });

      return docRef.id;
    } catch (error) {
      console.error('Firestore save error:', error);
      throw new Error('Failed to save document metadata');
    }
  }


  async getUserDocuments(userId: string): Promise<DocumentUpload[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const documents: DocumentUpload[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        documents.push({
          id: doc.id,
          userId: data.userId,
          filename: data.filename,
          originalUrl: data.originalUrl,
          processedUrls: data.processedUrls || [],
          timestamp: data.timestamp.toDate(),
          status: data.status,
          error: data.error,
          metadata: data.metadata
        });
      });

      return documents;
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw new Error('Failed to fetch documents');
    }
  }

  async updateDocumentStatus(
    documentId: string,
    status: 'processing' | 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, documentId);
      await updateDoc(docRef, {
        status,
        ...(error && { error })
      });
    } catch (error) {
      console.error('Error updating document status:', error);
      throw new Error('Failed to update document status');
    }
  }

  async deleteDocument(documentId: string, originalUrl: string, processedUrls: string[]): Promise<void> {
    try {
      // Delete from Storage
      const originalRef = ref(storage, originalUrl);
      await deleteObject(originalRef);

      for (const url of processedUrls) {
        const processedRef = ref(storage, url);
        await deleteObject(processedRef);
      }

      // Delete from Firestore would require admin SDK or Firebase Functions
      // For now, we'll just mark as deleted
      const docRef = doc(db, this.COLLECTION_NAME, documentId);
      await updateDoc(docRef, {
        status: 'deleted',
        deletedAt: Timestamp.now()
      });

    } catch (error) {
      console.error('Error deleting document:', error);
      throw new Error('Failed to delete document');
    }
  }
}

export const storageService = new StorageService();
