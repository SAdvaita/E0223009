import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Alert, Skeleton, Slider, Paper,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { fetchPriorityNotifications } from '../services/apiService.js';
import NotificationCard from '../components/NotificationCard.jsx';
import FilterBar        from '../components/FilterBar.jsx';
import { logFE }        from '../utils/logger.js';

const VIEWED_KEY = 'campus_notify_viewed';

function getViewedIds() {
  try   { return new Set(JSON.parse(localStorage.getItem(VIEWED_KEY) || '[]')); }
  catch { return new Set(); }
}

function persistViewed(id) {
  const v = getViewedIds();
  v.add(id);
  localStorage.setItem(VIEWED_KEY, JSON.stringify([...v]));
}

const SLIDER_MARKS = [5, 10, 15, 20, 25, 30].map((v) => ({ value: v, label: String(v) }));

export default function PriorityInboxPage() {
  const [notifications,       setNotifications]       = useState([]);
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [n,                   setN]                   = useState(10);
  const [notificationType,    setNotificationType]    = useState('');
  const [loading,             setLoading]             = useState(true);
  const [error,               setError]               = useState(null);
  const [viewedIds,           setViewedIds]           = useState(getViewedIds);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    await logFE('info', 'component', `PriorityInbox: loading top ${n}`);
    try {
      const data = await fetchPriorityNotifications(n);
      setNotifications(data.notifications ?? []);
      await logFE('info', 'api', `Priority: got ${(data.notifications??[]).length} items`);
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message ?? 'Failed to load priority';
      await logFE('error', 'api', `Priority fetch failed: ${msg}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [n]);

  useEffect(() => { load(); }, [load]);

  // Client-side type filter on priority results
  useEffect(() => {
    setFilteredNotifications(
      notificationType
        ? notifications.filter((item) => item.Type === notificationType)
        : notifications
    );
  }, [notifications, notificationType]);

  function handleMarkRead(id) {
    persistViewed(id);
    setViewedIds(getViewedIds());
    logFE('info', 'component', `Priority item marked read: ${id}`);
  }

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', pt: 1 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <StarIcon sx={{ color: '#D97706', fontSize: 28 }} />
          <Typography variant="h5" color="text.primary">
            Priority Inbox
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Ranked by importance × recency. Placements are weighted highest.
        </Typography>
      </Box>

      {/* Top-N slider */}
      <Paper
        elevation={0}
        sx={{
          p          : 2.5,
          mb         : 2,
          border     : '1px solid #EAEAE5',
          borderRadius: 2,
          bgcolor    : '#FAFAF8',
        }}
      >
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Show top{' '}
          <Box component="span" sx={{ color: '#4F46E5', fontSize: '1rem' }}>
            {n}
          </Box>{' '}
          notifications
        </Typography>
        <Slider
          id="top-n-slider"
          value={n}
          onChange={(_, val) => { setN(val); logFE('info', 'component', `Top-N slider changed to ${val}`); }}
          min={5}
          max={30}
          step={5}
          marks={SLIDER_MARKS}
          sx={{ color: '#4F46E5', mt: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          Score = Weight (Placement×3, Result×2, Event×1) × Recency Factor
        </Typography>
      </Paper>

      {/* Filter */}
      <FilterBar
        notificationType={notificationType}
        onTypeChange={setNotificationType}
        onReset={() => setNotificationType('')}
        totalItems={filteredNotifications.length}
      />

      {/* Error */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Skeletons */}
      {loading
        ? Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={88} sx={{ mb: 1.5, borderRadius: 2 }} />
          ))
        : (
          filteredNotifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <StarIcon sx={{ fontSize: 56, color: '#CBD5E1', mb: 1 }} />
              <Typography color="text.secondary">No notifications found</Typography>
            </Box>
          ) : (
            filteredNotifications.map((notif) => (
              <NotificationCard
                key={notif.ID}
                notification={notif}
                isNew={!viewedIds.has(notif.ID)}
                onMarkRead={handleMarkRead}
              />
            ))
          )
        )
      }
    </Box>
  );
}
