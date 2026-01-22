import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Grid,
  Chip,
  IconButton
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';

export interface Corner {
  x: number;
  y: number;
}
// interface
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
  originalUrl: string;
  status: 'pending' | 'detecting' | 'detected' | 'processing' | 'completed' | 'error';
  detection?: DetectionResult;
  croppedUrl?: string;
  error?: string;
}

interface ImagePreviewCardProps {
  item: ImageItem;
  onConfirm: (id: string, corners: Corner[]) => void;
  onRemove: (id: string) => void;
}

export const ImagePreviewCard: React.FC<ImagePreviewCardProps> = ({
  item,
  onConfirm,
  onRemove
}) => {
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const croppedCanvasRef = useRef<HTMLCanvasElement>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  
  const [corners, setCorners] = useState<Corner[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  
  const scaleRef = useRef(1);
  const originalInitialCorners = useRef<Corner[]>([]);

  useEffect(() => {
    if (item.detection?.corners) {
      const newCorners = item.detection.corners.map(([x, y]) => ({ x, y }));
      setCorners(newCorners);
      originalInitialCorners.current = newCorners.map(c => ({ ...c }));
    }
  }, [item.detection]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageElement(img);
    img.src = item.originalUrl;
  }, [item.originalUrl]);

  const drawOriginalCanvas = useCallback(() => {
    if (!imageElement || !originalCanvasRef.current) return;
    
    const canvas = originalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const maxSize = 280;
    const scale = Math.min(maxSize / imageElement.naturalWidth, maxSize / imageElement.naturalHeight, 1);
    scaleRef.current = scale;
    
    canvas.width = imageElement.naturalWidth * scale;
    canvas.height = imageElement.naturalHeight * scale;

    // Draw image
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

    if (corners.length === 4) {
      const scaledCorners = corners.map(c => ({
        x: c.x * scale,
        y: c.y * scale
      }));

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(scaledCorners[0].x, scaledCorners[0].y);
      for (let i = 1; i < scaledCorners.length; i++) {
        ctx.lineTo(scaledCorners[i].x, scaledCorners[i].y);
      }
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Draw border
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(scaledCorners[0].x, scaledCorners[0].y);
      for (let i = 1; i < scaledCorners.length; i++) {
        ctx.lineTo(scaledCorners[i].x, scaledCorners[i].y);
      }
      ctx.closePath();
      ctx.stroke();

      scaledCorners.forEach((corner, index) => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = draggingIndex === index ? '#2196F3' : '#4CAF50';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((index + 1).toString(), corner.x, corner.y);
      });
    }
  }, [imageElement, corners, draggingIndex]);

  const drawCroppedCanvas = useCallback(() => {
    if (!imageElement || !croppedCanvasRef.current || corners.length !== 4) return;
    
    const canvas = croppedCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const xs = corners.map(c => c.x);
    const ys = corners.map(c => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    if (cropWidth <= 0 || cropHeight <= 0) return;

    const maxSize = 280;
    const scale = Math.min(maxSize / cropWidth, maxSize / cropHeight, 1);
    canvas.width = cropWidth * scale;
    canvas.height = cropHeight * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(adjustedCorners[0].x, adjustedCorners[0].y);
    for (let i = 1; i < adjustedCorners.length; i++) {
      ctx.lineTo(adjustedCorners[i].x, adjustedCorners[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  }, [imageElement, corners]);

  useEffect(() => {
    if (imageElement && item.status !== 'completed') {
      drawOriginalCanvas();
      drawCroppedCanvas();
    }
  }, [imageElement, item.status, drawOriginalCanvas, drawCroppedCanvas]);

  const getCornerAtPosition = (x: number, y: number): number | null => {
    const scale = scaleRef.current;
    for (let i = 0; i < corners.length; i++) {
      const cx = corners[i].x * scale;
      const cy = corners[i].y * scale;
      if (Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) < 15) return i;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (item.status !== 'detected') return;
    const rect = originalCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const idx = getCornerAtPosition(e.clientX - rect.left, e.clientY - rect.top);
    if (idx !== null) {
      setDraggingIndex(idx);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (item.status !== 'detected') return;
    const canvas = originalCanvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = getCornerAtPosition(x, y);
    canvas.style.cursor = idx !== null || draggingIndex !== null ? 'grab' : 'default';

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
  const handleMouseLeave = () => setDraggingIndex(null);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (item.status !== 'detected' || e.touches.length !== 1) return;
    const rect = originalCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const idx = getCornerAtPosition(
      e.touches[0].clientX - rect.left,
      e.touches[0].clientY - rect.top
    );
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
    if (corners.length === 4) {
      onConfirm(item.id, corners);
    }
  };

  const getStatusChip = () => {
    switch (item.status) {
      case 'pending':
        return <Chip label="Pending" size="small" />;
      case 'detecting':
        return <Chip label="Detecting..." size="small" color="info" icon={<CircularProgress size={14} />} />;
      case 'detected':
        return <Chip label="Ready" size="small" color="success" />;
      case 'processing':
        return <Chip label="Processing..." size="small" color="warning" icon={<CircularProgress size={14} />} />;
      case 'completed':
        return <Chip label="Completed" size="small" color="success" icon={<CheckCircleIcon />} />;
      case 'error':
        return <Chip label="Error" size="small" color="error" icon={<ErrorIcon />} />;
      default:
        return null;
    }
  };

  return (
    <Card sx={{ position: 'relative', mb: 2 }}>
      <IconButton
        size="small"
        onClick={() => onRemove(item.id)}
        sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
        disabled={item.status === 'processing' || item.status === 'detecting'}
      >
        <CloseIcon />
      </IconButton>

      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2" noWrap sx={{ maxWidth: '70%' }}>
            {item.file.name}
          </Typography>
          {getStatusChip()}
        </Box>

        {item.error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {item.error}
          </Typography>
        )}

        <Grid container spacing={2}>
          {/* Original Image with draggable corners */}
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Original (drag corners to adjust)
            </Typography>
            <Box
              sx={{
                height: 200,
                bgcolor: 'grey.100',
                borderRadius: 1,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {item.status === 'completed' ? (
                <img
                  src={item.originalUrl}
                  alt="Original"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : imageElement && corners.length > 0 ? (
                <canvas
                  ref={originalCanvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={{ maxWidth: '100%', maxHeight: '100%', touchAction: 'none' }}
                />
              ) : imageElement ? (
                <img
                  src={item.originalUrl}
                  alt="Original"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : (
                <CircularProgress size={24} />
              )}
            </Box>
          </Grid>

          {/* Cropped Preview */}
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Cropped Preview
            </Typography>
            <Box
              sx={{
                height: 200,
                bgcolor: 'grey.100',
                borderRadius: 1,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {item.status === 'completed' && item.croppedUrl ? (
                <img
                  src={item.croppedUrl}
                  alt="Cropped"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : item.status === 'detecting' || item.status === 'pending' ? (
                <Box textAlign="center">
                  <CircularProgress size={24} />
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Detecting...
                  </Typography>
                </Box>
              ) : corners.length > 0 ? (
                <canvas
                  ref={croppedCanvasRef}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : item.error ? (
                <Typography variant="caption" color="error">
                  Detection failed
                </Typography>
              ) : null}
            </Box>
          </Grid>
        </Grid>

        {/* Detection info and action buttons */}
        {item.detection && item.status === 'detected' && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Confidence: {(item.detection.confidence * 100).toFixed(1)}% | Method: {item.detection.method}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={handleReset}
              >
                Reset
              </Button>
              <Button
                variant="contained"
                size="small"
                color="primary"
                startIcon={<CheckCircleIcon />}
                onClick={handleConfirm}
              >
                Confirm
              </Button>
            </Box>
          </Box>
        )}

        {item.status === 'processing' && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography variant="body2">Processing...</Typography>
          </Box>
        )}

        {item.detection?.warning && (
          <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
            ⚠️ {item.detection.warning}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default ImagePreviewCard;
