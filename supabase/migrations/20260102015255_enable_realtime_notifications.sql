/*
  # Enable Realtime for Notifications
  
  ## Overview
  Enables realtime updates for the notifications table so clients can
  receive instant updates when new notifications arrive.
  
  ## Changes
  1. Enable realtime publication for notifications table
*/

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
