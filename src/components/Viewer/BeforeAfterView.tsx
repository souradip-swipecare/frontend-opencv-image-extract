import React, { useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Paper,
  Button,
  Tabs,
  Tab
} from '@mui/material';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveIcon from '@mui/icons-material/Save';

interface BeforeAfterViewProps {
  originalImage: string;
  processedImages: string[];
  onSave: () => void;
  saving: boolean;
}

export const BeforeAfterView: React.FC<BeforeAfterViewProps> = ({
  originalImage,
  processedImages,
  onSave,
  saving
}) => {
  const [selectedProcessedIndex, setSelectedProcessedIndex] = useState(0);

  const ImageViewer = ({ src, title }: { src: string; title: string }) => (
    <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom textAlign="center">
        {title}
      </Typography>

      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        centerOnInit
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <Box sx={{ mb: 1, display: 'flex', justifyContent: 'center', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => zoomIn()}
                startIcon={<ZoomInIcon />}
              >
                Zoom In
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => zoomOut()}
                startIcon={<ZoomOutIcon />}
              >
                Zoom Out
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => resetTransform()}
                startIcon={<RestartAltIcon />}
              >
                Reset
              </Button>
            </Box>

            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'grey.100',
                height: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <TransformComponent
                wrapperStyle={{
                  width: '100%',
                  height: '100%'
                }}
                contentStyle={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img
                  src={src}
                  alt={title}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
              </TransformComponent>
            </Box>
          </>
        )}
      </TransformWrapper>
    </Paper>
  );

  return (
    <Box sx={{ mt: 3 }}>
      {processedImages.length > 1 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Detected Documents: {processedImages.length}
          </Typography>
          <Tabs
            value={selectedProcessedIndex}
            onChange={(_, newValue) => setSelectedProcessedIndex(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {processedImages.map((_, index) => (
              <Tab key={index} label={`Document ${index + 1}`} />
            ))}
          </Tabs>
        </Box>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <ImageViewer src={originalImage} title="Original" />
        </Grid>

        <Grid item xs={12} md={6}>
          <ImageViewer
            src={processedImages[selectedProcessedIndex]}
            title={
              processedImages.length > 1
                ? `Processed - Document ${selectedProcessedIndex + 1}`
                : 'Processed'
            }
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<SaveIcon />}
          onClick={onSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Document(s)'}
        </Button>
      </Box>
    </Box>
  );
};
