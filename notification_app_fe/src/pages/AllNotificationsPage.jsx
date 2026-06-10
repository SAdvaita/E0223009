import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Alert, Skeleton,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { fetchAllNotifications }  from '../services/apiService.js';
import NotificationCard           from '../components/NotificationCard.jsx';
import FilterBar                  from '../components/FilterBar.jsx';
import PaginationBar              from '../components/PaginationBar.jsx';
import { logFE }                  from '../utils/logger.js';

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

export default function AllNotificationsPage() {
  const [notifications,    setNotifications]    = useState([]);
  const [pagination,       setPagination]       = useState({ currentPage: 1, hasNextPage: false, hasPreviousPage: false });
  const [page,             setPage]             = useState(1);
  const [notificationType, setNotificationType] = useState('');
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);
  const [viewedIds,        setViewedIds]        = useState(getViewedIds);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    await logFE('info', 'component', `AllNotifications: page=${page} type=${notificationType||'all'}`);
    try {
      const data = await fetchAllNotifications({
        page,
        limit            : 10,
        notification_type: notificationType || undefined,
      });
      setNotifications(data.notifications ?? []);
      setPagination(data.pagination       ?? {});
      await logFE('info', 'api', `Fetched ${(data.notifications??[]).length} notifications`);
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message ?? 'Failed to load';
      await logFE('error', 'api', `AllNotifications fetch failed: ${msg}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, notificationType]);

  useEffect(() => { load(); }, [load]);

  function handleMarkRead(id) {
    persistViewed(id);
    setViewedIds(getViewedIds());
    logFE('info', 'component', `Notification marked as read: ${id}`);
  }

  function handleTypeChange(type) {
    setNotificationType(type);
    setPage(1);
    logFE('info', 'component', `Filter changed to: ${type || 'all'}`);
  }

  const newCount = notifications.filter((n) => !viewedIds.has(n.ID)).length;

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', pt: 1 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <NotificationsIcon sx={{ color: '#4F46E5', fontSize: 28 }} />
          <Typography variant="h5" color="text.primary">
            All Notifications
          </Typography>
          {newCount > 0 && (
            <Box
              sx={{
                bgcolor     : '#4F46E5',
                color       : 'white',
                borderRadius: '12px',
                px          : 1.25,
                py          : 0.2,
                fontSize    : '0.72rem',
                fontWeight  : 700,
              }}
            >
              {newCount} new
            </Box>
          )}
        </Box>
        <Typography variant="body2" color="text.secondary">
          Placement drives, college events, and academic results — all in one place.
        </Typography>
      </Box>

      {/* Filter */}
      <FilterBar
        notificationType={notificationType}
        onTypeChange={handleTypeChange}
        onReset={() => handleTypeChange('')}
        totalItems={notifications.length}
      />

      {/* Error */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Skeletons while loading */}
      {loading
        ? Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={88} sx={{ mb: 1.5, borderRadius: 2 }} />
          ))
        : (
          <>
            {notifications.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 10 }}>
                <NotificationsIcon sx={{ fontSize: 56, color: '#CBD5E1', mb: 1 }} />
                <Typography color="text.secondary">No notifications found</Typography>
              </Box>
            ) : (
              notifications.map((notif) => (
                <NotificationCard
                  key={notif.ID}
                  notification={notif}
                  isNew={!viewedIds.has(notif.ID)}
                  onMarkRead={handleMarkRead}
                />
              ))
            )}

            {notifications.length > 0 && (
              <PaginationBar
                currentPage={pagination.currentPage ?? page}
                totalPages={pagination.totalPages}
                hasNextPage={!!pagination.hasNextPage}
                hasPreviousPage={!!pagination.hasPreviousPage}
                onPageChange={setPage}
              />
            )}
          </>
        )
      }
    </Box>
  );
}
