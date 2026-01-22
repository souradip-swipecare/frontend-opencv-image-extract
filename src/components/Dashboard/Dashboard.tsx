import React, { useState, useCallback } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  Alert,
  CircularProgress,
  Tabs,
  Tab
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../contexts/AuthContext';
import { FileUpload } from '../Upload/FileUpload';
import { DocumentGallery } from '../Gallery/DocumentGallery';
import { ImagePreviewPanel, ImageItem, Corner } from '../Preview/ImagePreviewPanel';
import { storageService } from '../../services/storageService';
import { detectDocumentCorners, finalizeDocumentCrop } from '../../services/uploadService';
import { isPDF, convertPDFFirstPageToImage } from '../../utils/pdfUtils';

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const Dashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Multi-file state
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const updateImageItem = useCallback((id: string, updates: Partial<ImageItem>) => {
    setImageItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const processFile = async (item: ImageItem) => {
    setImageItems(prev => prev.map(i => 
      i.id === item.id ? { ...i, status: 'detecting' as const } : i
    ));

    try {
      let fileToProcess = item.file;
      
      if (isPDF(item.file)) {
        fileToProcess = await convertPDFFirstPageToImage(item.file);
        const newUrl = URL.createObjectURL(fileToProcess);
        setImageItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, file: fileToProcess, originalUrl: newUrl } : i
        ));
      }

      const result = await detectDocumentCorners(fileToProcess);

      if (!result.success) {
        throw new Error('Document detection failed');
      }

      setImageItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: 'detected' as const, detection: result } : i
      ));

    } catch (err: any) {
      setImageItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: 'error' as const, error: err.message || 'Detection failed' } : i
      ));
    }
  };

  const handleFilesSelected = useCallback((files: File[]) => {
    setError(null);
    setSuccess(null);

    const newItems: ImageItem[] = files.map(file => ({
      id: generateId(),
      file,
      originalUrl: URL.createObjectURL(file),
      status: 'pending' as const
    }));

    setImageItems(prev => [...prev, ...newItems]);

    // Start detection for each file
    newItems.forEach(item => processFile(item));
  }, []);

  const handleConfirm = useCallback(async (id: string, corners: Corner[]) => {
    const item = imageItems.find(i => i.id === id);
    if (!item || !item.detection?.fileId) {
      setError('Missing file ID from detection');
      return;
    }

    updateImageItem(id, { status: 'processing' });

    try {
      const result = await finalizeDocumentCrop(item.detection.fileId, corners);

      if (!result.success) {
        throw new Error('Processing failed');
      }

      updateImageItem(id, {
        status: 'completed',
        croppedUrl: result.croppedUrl
      });

      setSuccess(`${item.file.name} processed successfully!`);

    } catch (err: any) {
      updateImageItem(id, {
        status: 'error',
        error: err.message || 'Processing failed'
      });
      setError(`Failed to process ${item.file.name}: ${err.message}`);
    }
  }, [imageItems, updateImageItem]);

  // Handle remove image
  const handleRemove = useCallback((id: string) => {
    setImageItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) {
        URL.revokeObjectURL(item.originalUrl);
      }
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const handleSaveAll = async () => {
    const completedItems = imageItems.filter(item => item.status === 'completed');
    if (completedItems.length === 0 || !currentUser) return;

    setSaving(true);
    setError(null);

    try {
      for (const item of completedItems) {
        if (!item.croppedUrl) continue;

        // Upload images to Firebase Storage
        const { originalUrl, processedUrls } = await storageService.uploadImages(
          currentUser.uid,
          item.file.name,
          item.originalUrl,
          [item.croppedUrl]
        );

        // Save metadata to Firestore
        await storageService.saveDocumentMetadata(
          currentUser.uid,
          item.file.name,
          originalUrl,
          processedUrls,
          {
            fileType: item.file.name.split('.').pop(),
            timestamp: new Date()
          }
        );
      }

      setSuccess(`${completedItems.length} document(s) saved successfully!`);
      
      // Clear completed items after save
      setImageItems(prev => prev.filter(item => item.status !== 'completed'));
      
      // Switch to gallery after short delay
      setTimeout(() => setCurrentTab(1), 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to save documents');
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = () => {
    imageItems.forEach(item => URL.revokeObjectURL(item.originalUrl));
    setImageItems([]);
    setError(null);
    setSuccess(null);
  };

  const handleConfirmAll = async () => {
    const detectedItems = imageItems.filter(item => item.status === 'detected' && item.detection);
    
    for (const item of detectedItems) {
      if (item.detection?.corners) {
        const corners: Corner[] = item.detection.corners.map(([x, y]) => ({ x, y }));
        await handleConfirm(item.id, corners);
      }
    }
  };

  const completedCount = imageItems.filter(i => i.status === 'completed').length;
  const detectedCount = imageItems.filter(i => i.status === 'detected').length;
  const processingCount = imageItems.filter(i => i.status === 'processing' || i.status === 'detecting').length;

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Document Scanner
          </Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>
            {currentUser?.email}
          </Typography>
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
            <Tab label="Upload & Process" />
            <Tab label="Document Gallery" />
          </Tabs>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {currentTab === 0 && (
          <Box>
            <FileUpload 
              onFilesSelected={handleFilesSelected} 
              disabled={processingCount > 0}
            />

            {/* Image preview panel with tabs */}
            {imageItems.length > 0 && (
              <ImagePreviewPanel
                items={imageItems}
                onConfirm={handleConfirm}
                onRemove={handleRemove}
              />
            )}

            {imageItems.length > 0 && (
              <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                {detectedCount > 1 && (
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={handleConfirmAll}
                    disabled={processingCount > 0}
                  >
                    Confirm All ({detectedCount})
                  </Button>
                )}
                
                {completedCount > 0 && (
                  <Button 
                    variant="contained" 
                    color="success" 
                    onClick={handleSaveAll}
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : null}
                  >
                    {saving ? 'Saving...' : `Save All (${completedCount})`}
                  </Button>
                )}
                
                <Button 
                  variant="outlined" 
                  color="error" 
                  onClick={handleClearAll}
                  disabled={processingCount > 0 || saving}
                >
                  Clear All
                </Button>
              </Box>
            )}

            {imageItems.length === 0 && (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  Upload images or PDFs to get started
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {currentTab === 1 && <DocumentGallery />}
      </Container>
    </>
  );
};

export default Dashboard;
