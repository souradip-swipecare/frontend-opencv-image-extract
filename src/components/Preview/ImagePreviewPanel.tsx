import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Grid,
  Tabs,
  Tab,
  Chip,
  IconButton
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';

export interface Corner {
  x: number;
  y: number;
}

// Updated to match actual API response
export interface DetectionResult {
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

export interface ImageItem {
  id: string;
  file: File;
  originalUrl: string;  // Local blob URL for display before upload
  status: 'pending' | 'detecting' | 'detected' | 'processing' | 'completed' | 'error';
  detection?: DetectionResult;
  croppedUrl?: string;
  error?: string;
}

interface ImagePreviewPanelProps {
  items: ImageItem[];
  onConfirm: (id: string, corners: Corner[]) => void;
  onRemove: (id: string) => void;
}

export const ImagePreviewPanel: React.FC<ImagePreviewPanelProps> = ({
  items,
  onConfirm,
  onRemove
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const croppedCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [corners, setCorners] = useState<Corner[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 500, height: 400 });
  
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const originalInitialCorners = useRef<Corner[]>([]);

  const selectedItem = items[selectedIndex] || null;

  // Update selected index when items change
  useEffect(() => {
    if (selectedIndex >= items.length && items.length > 0) {
      setSelectedIndex(items.length - 1);
    }
  }, [items.length, selectedIndex]);

  // Load image when selected item changes - use previewUrl from detection for cropping
  useEffect(() => {
    if (!selectedItem) {
      setImageElement(null);
      setCorners([]);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous"; // Allow cross-origin images from Cloudinary
    img.onload = () => setImageElement(img);
    
    // Use previewUrl from detection result (Cloudinary URL) if available, otherwise use local blob
    const imageUrl = selectedItem.detection?.previewUrl || selectedItem.originalUrl;
    img.src = imageUrl;
  }, [selectedItem?.detection?.previewUrl, selectedItem?.originalUrl, selectedItem?.id]);

  // Initialize corners when detection result arrives
  useEffect(() => {
    if (selectedItem?.detection?.corners) {
      const newCorners = selectedItem.detection.corners.map(([x, y]) => ({ x, y }));
      setCorners(newCorners);
      originalInitialCorners.current = newCorners.map(c => ({ ...c }));
    } else {
      setCorners([]);
      originalInitialCorners.current = [];
    }
  }, [selectedItem?.detection, selectedItem?.id]);

  // Draw original canvas with corner handles
  const drawOriginalCanvas = useCallback(() => {
    if (!imageElement || !originalCanvasRef.current || !containerRef.current) return;
    
    const canvas = originalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const containerWidth = containerRef.current.clientWidth / 2 - 24;
    const maxHeight = 500;
    
    const scaleX = containerWidth / imageElement.naturalWidth;
    const scaleY = maxHeight / imageElement.naturalHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    scaleRef.current = scale;
    
    const displayWidth = imageElement.naturalWidth * scale;
    const displayHeight = imageElement.naturalHeight * scale;
    
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    setCanvasSize({ width: displayWidth, height: displayHeight });

    // Draw image
    ctx.drawImage(imageElement, 0, 0, displayWidth, displayHeight);

    // Draw corner polygon if we have corners
    if (corners.length === 4) {
      const scaledCorners = corners.map(c => ({
        x: c.x * scale,
        y: c.y * scale
      }));

      // Draw semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cut out the selected region
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(scaledCorners[0].x, scaledCorners[0].y);
      for (let i = 1; i < scaledCorners.length; i++) {
        ctx.lineTo(scaledCorners[i].x, scaledCorners[i].y);
      }
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(imageElement, 0, 0, displayWidth, displayHeight);
      ctx.restore();

      // Draw border
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(scaledCorners[0].x, scaledCorners[0].y);
      for (let i = 1; i < scaledCorners.length; i++) {
        ctx.lineTo(scaledCorners[i].x, scaledCorners[i].y);
      }
      ctx.closePath();
      ctx.stroke();

      // Draw draggable corner handles
      scaledCorners.forEach((corner, index) => {
        // Outer circle
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = draggingIndex === index ? '#2196F3' : '#4CAF50';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Corner number
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((index + 1).toString(), corner.x, corner.y);
      });
    }
  }, [imageElement, corners, draggingIndex]);

  // Draw cropped preview canvas
  const drawCroppedCanvas = useCallback(() => {
    if (!imageElement || !croppedCanvasRef.current || corners.length !== 4 || !containerRef.current) return;
    
    const canvas = croppedCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate bounding box
    const xs = corners.map(c => c.x);
    const ys = corners.map(c => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    if (cropWidth <= 0 || cropHeight <= 0) return;

    const containerWidth = containerRef.current.clientWidth / 2 - 24;
    const maxHeight = 500;
    const scale = Math.min(containerWidth / cropWidth, maxHeight / cropHeight, 1);
    
    canvas.width = cropWidth * scale;
    canvas.height = cropHeight * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create clipping path
    ctx.save();
    ctx.beginPath();
    const adjustedCorners = corners.map(c => ({
      x: (c.x - minX) * scale,
      y: (c.y - minY) * scale
    }));
    
    ctx.moveTo(adjustedCorners[0].x, adjustedCorners[0].y);
    for (let i = 1; i < adjustedCorners.length; i++) {
      ctx.lineTo(adjustedCorners[i].x, adjustedCorners[i].y);
    }
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      imageElement,
      minX, minY, cropWidth, cropHeight,
      0, 0, canvas.width, canvas.height
    );
    ctx.restore();

    // Draw border
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(adjustedCorners[0].x, adjustedCorners[0].y);
    for (let i = 1; i < adjustedCorners.length; i++) {
      ctx.lineTo(adjustedCorners[i].x, adjustedCorners[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  }, [imageElement, corners]);

  // Redraw canvases when dependencies change
  useEffect(() => {
    if (imageElement && selectedItem?.status !== 'completed') {
      drawOriginalCanvas();
      drawCroppedCanvas();
    }
  }, [imageElement, selectedItem?.status, drawOriginalCanvas, drawCroppedCanvas]);

  // Mouse handlers for dragging corners
  const getCornerAtPosition = (x: number, y: number): number | null => {
    const scale = scaleRef.current;
    for (let i = 0; i < corners.length; i++) {
      const cx = corners[i].x * scale;
      const cy = corners[i].y * scale;
      const distance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (distance < 20) return i;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedItem || selectedItem.status !== 'detected') return;
    const rect = originalCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = getCornerAtPosition(x, y);
    
    if (idx !== null) {
      setDraggingIndex(idx);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedItem || selectedItem.status !== 'detected') return;
    const canvas = originalCanvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = getCornerAtPosition(x, y);
    canvas.style.cursor = idx !== null || draggingIndex !== null ? 'grab' : 'crosshair';

    if (draggingIndex !== null && imageElement) {
      canvas.style.cursor = 'grabbing';
      const scale = scaleRef.current;
      const imageX = Math.max(0, Math.min(x / scale, imageElement.naturalWidth));
      const imageY = Math.max(0, Math.min(y / scale, imageElement.naturalHeight));

      setCorners(prev => {
        const newCorners = [...prev];
        newCorners[draggingIndex] = { x: imageX, y: imageY };
        return newCorners;
      });
    }
  };

  const handleMouseUp = () => setDraggingIndex(null);
  
  const handleMouseLeave = () => {
    if (draggingIndex !== null) {
      setDraggingIndex(null);
    }
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!selectedItem || selectedItem.status !== 'detected' || e.touches.length !== 1) return;
    const rect = originalCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    const idx = getCornerAtPosition(x, y);
    
    if (idx !== null) {
      setDraggingIndex(idx);
      e.preventDefault();
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (draggingIndex === null || e.touches.length !== 1 || !imageElement) return;
    const rect = originalCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    const scale = scaleRef.current;
    const imageX = Math.max(0, Math.min(x / scale, imageElement.naturalWidth));
    const imageY = Math.max(0, Math.min(y / scale, imageElement.naturalHeight));

    setCorners(prev => {
      const newCorners = [...prev];
      newCorners[draggingIndex] = { x: imageX, y: imageY };
      return newCorners;
    });
    e.preventDefault();
  };

  const handleTouchEnd = () => setDraggingIndex(null);

  const handleReset = () => {
    if (originalInitialCorners.current.length > 0) {
      setCorners(originalInitialCorners.current.map(c => ({ ...c })));
    }
  };

  const handleConfirm = () => {
    if (selectedItem && corners.length === 4) {
      onConfirm(selectedItem.id, corners);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'detected': return 'success';
      case 'processing': case 'detecting': return 'warning';
      case 'completed': return 'success';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'detecting': return 'Detecting...';
      case 'detected': return 'Ready';
      case 'processing': return 'Processing...';
      case 'completed': return 'Done';
      case 'error': return 'Error';
      default: return status;
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      {/* File Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs 
          value={selectedIndex} 
          onChange={(_, newValue) => setSelectedIndex(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {items.map((item, index) => (
            <Tab
              key={item.id}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>
                    {item.file.name}
                  </Typography>
                  <Chip 
                    label={getStatusLabel(item.status)} 
                    size="small" 
                    color={getStatusColor(item.status) as any}
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    sx={{ ml: 0.5, p: 0.25 }}
                    disabled={item.status === 'processing' || item.status === 'detecting'}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              }
              sx={{ minHeight: 48 }}
            />
          ))}
        </Tabs>
      </Box>

      {/* Selected Item Preview */}
      {selectedItem && (
        <Box ref={containerRef}>
          {selectedItem.error && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
              <Typography color="error.dark">
                <ErrorIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                {selectedItem.error}
              </Typography>
            </Box>
          )}

          {(selectedItem.status === 'pending' || selectedItem.status === 'detecting') && (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
              <Box textAlign="center">
                <CircularProgress size={60} />
                <Typography variant="h6" sx={{ mt: 2 }}>
                  Detecting document...
                </Typography>
              </Box>
            </Box>
          )}

          {selectedItem.status === 'processing' && (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
              <Box textAlign="center">
                <CircularProgress size={60} />
                <Typography variant="h6" sx={{ mt: 2 }}>
                  Processing document...
                </Typography>
              </Box>
            </Box>
          )}

          {(selectedItem.status === 'detected' || selectedItem.status === 'completed') && imageElement && (
            <>
              <Grid container spacing={3}>
                {/* Original Image with draggable corners */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Original Image
                    {selectedItem.status === 'detected' && (
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                        (Drag corners to adjust)
                      </Typography>
                    )}
                  </Typography>
                  <Box
                    sx={{
                      bgcolor: 'grey.200',
                      borderRadius: 1,
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 400
                    }}
                  >
                    {selectedItem.status === 'completed' ? (
                      <img
                        src={selectedItem.detection?.originalUrl || selectedItem.originalUrl}
                        alt="Original"
                        crossOrigin="anonymous"
                        style={{ maxWidth: '100%', maxHeight: 500, objectFit: 'contain' }}
                      />
                    ) : (
                      <canvas
                        ref={originalCanvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        style={{ 
                          touchAction: 'none',
                          cursor: 'crosshair'
                        }}
                      />
                    )}
                  </Box>
                </Grid>

                {/* Cropped Preview */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Cropped Preview
                  </Typography>
                  <Box
                    sx={{
                      bgcolor: 'grey.200',
                      borderRadius: 1,
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 400
                    }}
                  >
                    {selectedItem.status === 'completed' && selectedItem.croppedUrl ? (
                      <img
                        src={selectedItem.croppedUrl}
                        alt="Cropped"
                        style={{ maxWidth: '100%', maxHeight: 500, objectFit: 'contain' }}
                      />
                    ) : corners.length > 0 ? (
                      <canvas
                        ref={croppedCanvasRef}
                        style={{ maxWidth: '100%', maxHeight: 500 }}
                      />
                    ) : (
                      <Typography color="text.secondary">
                        Waiting for detection...
                      </Typography>
                    )}
                  </Box>
                </Grid>
              </Grid>

              {selectedItem.detection && selectedItem.status === 'detected' && (
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Confidence: <strong>{(selectedItem.detection.confidence * 100).toFixed(1)}%</strong> | 
                      Method: <strong>{selectedItem.detection.method}</strong>
                    </Typography>
                    {selectedItem.detection.warning && (
                      <Typography variant="body2" color="warning.main" sx={{ mt: 0.5 }}>
                        ⚠️ {selectedItem.detection.warning}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={handleReset}
                    >
                      Reset Corners
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<CheckCircleIcon />}
                      onClick={handleConfirm}
                      size="large"
                    >
                      Confirm & Process
                    </Button>
                  </Box>
                </Box>
              )}

              {selectedItem.status === 'completed' && (
                <Box sx={{ mt: 3, textAlign: 'center' }}>
                  <Chip 
                    icon={<CheckCircleIcon />} 
                    label="Processing Complete" 
                    color="success" 
                    size="medium"
                  />
                </Box>
              )}
            </>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default ImagePreviewPanel;
