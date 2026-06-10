import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon  from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export default function PaginationBar({
  currentPage,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
}) {
  return (
    <Box
      sx={{
        display       : 'flex',
        alignItems    : 'center',
        justifyContent: 'center',
        gap           : 2,
        mt            : 3,
        py            : 1.5,
      }}
    >
      <IconButton
        id="prev-page-btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPreviousPage}
        size="small"
        aria-label="Previous page"
        sx={{
          bgcolor  : hasPreviousPage ? '#EEF2FF' : 'transparent',
          color    : hasPreviousPage ? '#4F46E5' : '#CBD5E1',
          '&:hover': { bgcolor: '#E0E7FF' },
        }}
      >
        <ChevronLeftIcon />
      </IconButton>

      <Typography
        variant="body2"
        sx={{
          px        : 3,
          py        : 0.75,
          bgcolor   : '#4F46E5',
          color     : 'white',
          borderRadius: 2,
          fontWeight: 600,
          minWidth  : 90,
          textAlign : 'center',
          userSelect: 'none',
        }}
      >
        Page {currentPage}{totalPages ? ` of ${totalPages}` : ''}
      </Typography>

      <IconButton
        id="next-page-btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNextPage}
        size="small"
        aria-label="Next page"
        sx={{
          bgcolor  : hasNextPage ? '#EEF2FF' : 'transparent',
          color    : hasNextPage ? '#4F46E5' : '#CBD5E1',
          '&:hover': { bgcolor: '#E0E7FF' },
        }}
      >
        <ChevronRightIcon />
      </IconButton>
    </Box>
  );
}
