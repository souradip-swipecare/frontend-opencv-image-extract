import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  CardActions,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Chip
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAuth } from '../../contexts/AuthContext';
import { listUserUploads, UploadListItem } from '../../services/uploadService';
import { auth } from '../../config/firebase';
// Delete API call
async function deleteUserUpload(fileId: string): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const token = await user.getIdToken();
    const formData = new FormData();
    formData.append('file_id', fileId);
    const response = await fetch('http://127.0.0.1:8000/api/v1/uploads/uploads/delete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (!response.ok) throw new Error('Delete failed');
    const data = await response.json();
    return data.success;
  } catch (err) {
    console.error('Delete error:', err);
    return false;
  }
}



export const DocumentGallery: React.FC = () => {
  const { currentUser } = useAuth();
  const [documents, setDocuments] = useState<UploadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<UploadListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 20;
  const loadDocuments = useCallback(async (cursor: string | null = null, append: boolean = false) => {
    if (!currentUser) return;
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }
      const response = await listUserUploads(ITEMS_PER_PAGE, cursor);
      if (response.success) {
        if (append) {
          setDocuments(prev => [...prev, ...response.uploads]);
        } else {
          setDocuments(response.uploads);
        }
        setHasMore(response.hasMore);
        setNextCursor(response.nextCursor);
      }
    } catch (err: any) {
      console.error('Error loading documents:', err);
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleLoadMore = () => {
    if (hasMore && nextCursor && !loadingMore) {
      loadDocuments(nextCursor, true);
    }
  };

  const handleRefresh = () => {
    setDocuments([]);
    setNextCursor(null);
    loadDocuments(null, false);
  };

  const handleViewDocument = (doc: UploadListItem) => {
    setSelectedDocument(doc);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedDocument(null);
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusColor = (status: string): "success" | "warning" | "error" | "default" => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        sx={{ mt: 2 }}
        action={
          <Button color="inherit" size="small" onClick={handleRefresh}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (documents.length === 0) {
    return (
      <Box textAlign="center" py={6}>
        <Typography variant="h6" color="text.secondary">
          No documents yet. Upload your first document to get started!
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5">
            Your Documents ({documents.length}{hasMore ? '+' : ''})
          </Typography>
          <Button 
            startIcon={<RefreshIcon />} 
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        <Grid container spacing={3}>
          {documents.map((doc) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={doc.fileId}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Show previewUrl if available, else croppedUrl, else originalUrl */}
                <CardMedia
                  component="img"
                  height="180"
                  image={doc.croppedUrl || doc.previewUrl || doc.originalUrl}
                  alt={doc.filename}
                  sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle2" noWrap title={doc.filename}>
                    {doc.filename}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {formatDate(doc.createdAt)}
                  </Typography>
                  <Chip 
                    label={doc.isProcessed ? 'Processed' : doc.status} 
                    size="small" 
                    color={doc.isProcessed ? 'success' : getStatusColor(doc.status)}
                    sx={{ mt: 1 }}
                  />
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<VisibilityIcon />}
                    onClick={() => handleViewDocument(doc)}
                  >
                    View
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={async () => {
                      if (window.confirm('Delete this document?')) {
                        const ok = await deleteUserUpload(doc.fileId);
                        if (ok) setDocuments(prev => prev.filter(d => d.fileId !== doc.fileId));
                        else alert('Delete failed');
                      }
                    }}
                  >
                    Delete
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Load More Button */}
        {hasMore && (
          <Box display="flex" justifyContent="center" mt={4}>
            <Button
              variant="outlined"
              onClick={handleLoadMore}
              disabled={loadingMore}
              startIcon={loadingMore ? <CircularProgress size={20} /> : null}
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </Button>
          </Box>
        )}
      </Box>

      {/* Document View Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" noWrap sx={{ maxWidth: '80%' }}>
              {selectedDocument?.filename}
            </Typography>
            <IconButton onClick={handleCloseDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedDocument && (
            <Grid container spacing={3}>
              {/* Original Image */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  Original
                </Typography>
                <Box
                  sx={{
                    bgcolor: 'grey.100',
                    borderRadius: 1,
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 300
                  }}
                >
                  <img
                    src={selectedDocument.originalUrl}
                    alt="Original"
                    style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain' }}
                  />
                </Box>
              </Grid>
               <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  System Detect image
                </Typography>
                <Box
                  sx={{
                    bgcolor: 'grey.100',
                    borderRadius: 1,
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 300
                  }}
                >
                  {selectedDocument.previewUrl ? (
                    <img
                      src={selectedDocument.previewUrl}
                      alt="Cropped"
                      style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain' }}
                    />
                  ) : (
                    <Typography color="text.secondary">
                      Not yet processed
                    </Typography>
                  )}
                </Box>
              </Grid>
              {/* Cropped Image */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  Cropped
                </Typography>
                <Box
                  sx={{
                    bgcolor: 'grey.100',
                    borderRadius: 1,
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 300
                  }}
                >
                  {selectedDocument.croppedUrl ? (
                    <img
                      src={selectedDocument.croppedUrl}
                      alt="Cropped"
                      style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain' }}
                    />
                  ) : (
                    <Typography color="text.secondary">
                      Not yet processed
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
