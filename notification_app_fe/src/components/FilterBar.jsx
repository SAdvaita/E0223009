import React from 'react';
import {
  Box, FormControl, InputLabel, Select, MenuItem,
  Button, Typography,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon     from '@mui/icons-material/Clear';

const TYPES = ['Event', 'Result', 'Placement'];

export default function FilterBar({
  notificationType,
  onTypeChange,
  onReset,
  totalItems,
}) {
  return (
    <Box
      sx={{
        display   : 'flex',
        alignItems: 'center',
        gap       : 2,
        flexWrap  : 'wrap',
        py        : 1.5,
        px        : 2,
        bgcolor   : '#FFFFFF',
        borderRadius: 2,
        border    : '1px solid #EAEAE5',
        mb        : 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <FilterListIcon sx={{ color: '#64748B', fontSize: 18 }} />
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          Filter
        </Typography>
      </Box>

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="filter-type-label">Notification Type</InputLabel>
        <Select
          labelId="filter-type-label"
          id="filter-type-select"
          value={notificationType}
          label="Notification Type"
          onChange={(e) => onTypeChange(e.target.value)}
        >
          <MenuItem value="">All Types</MenuItem>
          {TYPES.map((t) => (
            <MenuItem key={t} value={t}>{t}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {notificationType && (
        <Button
          id="clear-filter-btn"
          size="small"
          startIcon={<ClearIcon />}
          onClick={onReset}
          variant="text"
          sx={{ color: '#64748B', textTransform: 'none' }}
        >
          Clear
        </Button>
      )}

      {totalItems !== undefined && (
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
          {totalItems} {totalItems === 1 ? 'notification' : 'notifications'}
        </Typography>
      )}
    </Box>
  );
}
