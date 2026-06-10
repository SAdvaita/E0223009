import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, Divider,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import StarIcon          from '@mui/icons-material/Star';
import CampaignIcon     from '@mui/icons-material/Campaign';

const NAV_ITEMS = [
  { label: 'All Notifications', path: '/all',      icon: <NotificationsIcon /> },
  { label: 'Priority Inbox',    path: '/priority', icon: <StarIcon /> },
];

export default function Sidebar({ width = 240 }) {
  const { pathname } = useLocation();

  const content = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#FFFFFF' }}>
      {/* Brand */}
      <Box sx={{ px: 3, py: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CampaignIcon sx={{ color: '#4F46E5', fontSize: 26 }} />
        <Box>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, color: '#1E1B4B', lineHeight: 1.2 }}
          >
            Campus Notify
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Stay in the loop
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: '#EAEAE5' }} />

      <List sx={{ px: 1.5, pt: 1.5, flexGrow: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                id={`nav-${item.path.slice(1)}`}
                component={NavLink}
                to={item.path}
                sx={{
                  borderRadius: 2,
                  px: 2,
                  py: 1.25,
                  bgcolor    : active ? '#EEF2FF' : 'transparent',
                  color      : active ? '#4F46E5' : '#64748B',
                  '&:hover'  : { bgcolor: '#F5F5F0' },
                  '& .MuiListItemIcon-root': {
                    color: active ? '#4F46E5' : '#94A3B8',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: active ? 600 : 400 }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: '#EAEAE5' }} />
      <Box sx={{ px: 3, py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Notification Platform v1.0
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        display: { xs: 'none', md: 'block' },
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          border   : 'none',
          borderRight: '1px solid #EAEAE5',
        },
      }}
    >
      {content}
    </Drawer>
  );
}
