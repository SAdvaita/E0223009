import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from './components/Sidebar.jsx';
import AllNotificationsPage from './pages/AllNotificationsPage.jsx';
import PriorityInboxPage from './pages/PriorityInboxPage.jsx';

const SIDEBAR_WIDTH = 240;

export default function App() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar width={SIDEBAR_WIDTH} />
      <Box
        component="main"
        sx={{
          flexGrow : 1,
          ml       : { xs: 0, md: `${SIDEBAR_WIDTH}px` },
          p        : { xs: 2, md: 3 },
          minHeight: '100vh',
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/all" replace />} />
          <Route path="/all"      element={<AllNotificationsPage />} />
          <Route path="/priority" element={<PriorityInboxPage />} />
        </Routes>
      </Box>
    </Box>
  );
}
