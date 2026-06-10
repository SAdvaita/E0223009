import React from 'react';
import { Card, CardContent, Box, Typography, Chip } from '@mui/material';
import WorkIcon         from '@mui/icons-material/Work';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EventIcon       from '@mui/icons-material/Event';
import FiberNewIcon    from '@mui/icons-material/FiberNew';

const TYPE_CONFIG = {
  Placement: {
    color      : '#B45309',
    bgColor    : '#FEF3C7',
    borderColor: '#F59E0B',
    icon       : <WorkIcon fontSize="small" />,
  },
  Result: {
    color      : '#047857',
    bgColor    : '#D1FAE5',
    borderColor: '#10B981',
    icon       : <EmojiEventsIcon fontSize="small" />,
  },
  Event: {
    color      : '#1D4ED8',
    bgColor    : '#DBEAFE',
    borderColor: '#3B82F6',
    icon       : <EventIcon fontSize="small" />,
  },
};

function formatTs(ts) {
  try {
    const d = new Date(ts.replace(' ', 'T'));
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

export default function NotificationCard({ notification, isNew, onMarkRead }) {
  const { ID, Type, Message, Timestamp, priorityScore } = notification;
  const cfg = TYPE_CONFIG[Type] ?? TYPE_CONFIG.Event;

  return (
    <Card
      id={`notif-${ID}`}
      onClick={() => onMarkRead?.(ID)}
      sx={{
        mb        : 1.5,
        cursor    : 'pointer',
        borderLeft: `4px solid ${isNew ? cfg.borderColor : '#E2E8F0'}`,
        opacity   : isNew ? 1 : 0.72,
        transition: 'all 0.18s ease',
        '&:hover' : {
          transform : 'translateX(3px)',
          boxShadow : '0 4px 14px rgba(0,0,0,0.09)',
          opacity   : 1,
        },
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            {/* Type badge */}
            <Chip
              icon={cfg.icon}
              label={Type}
              size="small"
              sx={{
                bgcolor: cfg.bgColor,
                color  : cfg.color,
                fontSize: '0.7rem',
                '& .MuiChip-icon': { color: cfg.color },
              }}
            />
            {/* New badge */}
            {isNew && (
              <Chip
                icon={<FiberNewIcon />}
                label="New"
                size="small"
                sx={{ bgcolor: '#EEF2FF', color: '#4F46E5', fontSize: '0.7rem' }}
              />
            )}
            {/* Priority score (only on priority page) */}
            {priorityScore !== undefined && (
              <Chip
                label={`Score: ${priorityScore}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem', color: '#64748B', borderColor: '#E2E8F0' }}
              />
            )}
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ whiteSpace: 'nowrap', mt: 0.25, flexShrink: 0 }}
          >
            {formatTs(Timestamp)}
          </Typography>
        </Box>

        <Typography
          variant="body2"
          sx={{
            mt        : 1,
            fontWeight: isNew ? 500 : 400,
            color     : isNew ? 'text.primary' : 'text.secondary',
            lineHeight: 1.55,
          }}
        >
          {Message}
        </Typography>

        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 0.5, color: '#94A3B8', fontSize: '0.62rem' }}
        >
          ID: {ID}
        </Typography>
      </CardContent>
    </Card>
  );
}
