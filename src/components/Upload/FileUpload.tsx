import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Typography,
  Paper,
  Alert
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

// Allowed file types
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, disabled = false }) => {
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: `${file.name}: Only PNG, JPEG, and PDF files are supported` };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `${file.name}: File size must be less than 10MB` };
    }
    return { valid: true };
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);
      
      // Validate all files
      const validFiles: File[] = [];
      const errors: string[] = [];
      
      for (const file of acceptedFiles) {
        const validation = validateFile(file);
        if (validation.valid) {
          validFiles.push(file);
        } else {
          errors.push(validation.error || 'Invalid file');
        }
      }
      
      if (errors.length > 0) {
        setError(errors.join('\n'));
      }
      
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    multiple: true,
    disabled: disabled
  });

  return (
    <Box sx={{ mb: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)} style={{ whiteSpace: 'pre-line' }}>
          {error}
        </Alert>
      )}

      <Paper
        {...getRootProps()}
        elevation={isDragActive ? 8 : 2}
        sx={{
          p: 4,
          textAlign: 'center',
          cursor: disabled ? 'default' : 'pointer',
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.3s ease',
          '&:hover': {
            borderColor: disabled ? 'divider' : 'primary.main',
            bgcolor: disabled ? 'background.paper' : 'action.hover'
          }
        }}
      >
        <input {...getInputProps()} />

        <Box>
          <CloudUploadIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive
              ? 'Drop files here'
              : 'Drag & drop files here, or click to select'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Supported formats: PNG, JPEG, PDF (Multiple files allowed)
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default FileUpload;
